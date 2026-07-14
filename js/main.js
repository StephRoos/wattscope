// ============================================================================
// WATTSCOPE — Courbe de charge energetique en D3.js
// ============================================================================
// Phase 1, etapes 1-5 du plan de developpement Wattscope.
//
// Ce fichier :
// 1. Charge un CSV de courbe de charge (data/sample.csv, 8760 points horaires)
// 2. Aggrege par jour (365 points) pour la lisibilite
// 3. Calcule le base load (5e percentile des nuits 00h-06h)
// 4. Dessine un line chart avec annotations (SWD)
// 5. Propose une analyse narrative via Ollama (qwen2.5:7b, local)
//
// Concepts D3 maitrises : csv, timeParse, scaleTime, scaleLinear, line,
//   rollups, quantile, curveMonotoneX, axisBottom, axisLeft, timeFormat
//
// Principes SWD appliques : declutter, axe Y non-zero, 70-80% vertical,
//   couleur strategique, annotations, titre narratif
// ============================================================================

// 1. Dimensions du chart
// margin : espace reserve autour de la zone de dessin pour les axes et labels
// width/height : dimensions UTILES (sans les marges) = zone ou les donnees sont dessinees
const margin = { top: 60, right: 40, bottom: 50, left: 70 };
const width = 900 - margin.left - margin.right;   // 790px utiles
const height = 400 - margin.top - margin.bottom;   // 290px utiles

// Dimensions de l'overview (mini-chart en bas pour le brush/zoom)
// Pattern "overview + detail" : l'overview montre toute l'annee,
// l'utilisateur selectionne une periode, et le chart principal zoome
const overviewHeight = 50;          // hauteur du mini-chart
const overviewGap = 20;             // espace entre chart principal et overview
const totalHeight = height + overviewGap + overviewHeight;  // hauteur totale utile

// 2. Parser de dates
// d3.timeParse convertit une string en objet Date
// "%Y-%m-%d %H:%M:%S" = format ISO : 2023-01-01 00:00:00
// FONDAMENTAL : sans parsing, D3 ne peut pas trier les dates ni utiliser scaleTime
const parseTime = d3.timeParse("%Y-%m-%d %H:%M:%S");

// 3. Palette de couleurs (Wattscope — sobre, un accent)
// Les couleurs sont des variables CSS definies dans index.html.
// Avantage : quand on bascule en mode sombre, les variables changent
// et les elements SVG se mettent a jour automatiquement (pas besoin de redessiner).
const COLORS = {
  primary: "var(--ws-primary)",    // teal clair en dark — courbe principale
  base: "var(--ws-base)",          // gris — base load
  accent: "var(--ws-accent)",      // orange — annotation pic
  grid: "var(--ws-grid)",          // gris tres clair / slate-700 en dark — gridlines
  text: "var(--ws-text)",          // gris fonce / slate-100 en dark — texte principal
  muted: "var(--ws-muted)",        // gris moyen / slate-400 en dark — labels secondaires
};

// 4. Charger les donnees
// d3.csv() est asynchrone : renvoie une Promise. Tout le code du chart est dans .then()
// Les valeurs arrivent en STRING par defaut — il faut les convertir (Date + number)
d3.csv("data/sample.csv").then(data => {
  // Conversion des types : string → Date (timestamp) et string → number (power_kW)
  // Le + devant d.power_kW force la conversion en nombre (equivalent a Number(d.power_kW))
  // SANS cette conversion : d3.max() ferait un tri ALPHABETIQUE ("99" > "540")
  data.forEach(d => {
    d.timestamp = parseTime(d.timestamp);  // string → Date
    d.power_kW = +d.power_kW;               // string → number
  });

  // 4b. Aggreger par jour (moyenne quotidienne)
  // PROBLEME : 8760 points horaires sur 790px = 11 points par pixel = illisible
  // SOLUTION : regrouper par jour (365 points) = 2.2px par point = lisible
  //
  // d3.rollups(data, reduce, key) = equivalent d'un GROUP BY SQL :
  //   - data : les donnees brutes
  //   - v => d3.mean(v, ...) : l'agregation (moyenne des kW par jour)
  //   - d => d3.timeDay(d.timestamp) : la cle de regroupement (tronque l'heure, garde le jour)
  //
  // Resultat : [[Date, avgkW], [Date, avgkW], ...] qu'on transforme en [{date, avgkW}, ...]
  const dailyData = d3.rollups(
    data,
    v => d3.mean(v, d => d.power_kW),
    d => d3.timeDay(d.timestamp)
  ).map(([date, avgkW]) => ({ date, avgkW }));

  // Variables pour stocker l'etat du zoom et du panneau IA (mises a jour par brushed())
  let zoomedDailyData = dailyData.slice();
  let zoomRange = {
    start: d3.extent(dailyData, d => d.date)[0],
    end: d3.extent(dailyData, d => d.date)[1]
  };
  let aiPanel = null;  // assigne plus bas, dans la section du bouton IA

  // Donnees partagees pour la heatmap (doivent exister avant le brush au demarrage)
  const allDays = [...new Set(data.map(d => d3.timeDay(d.timestamp).getTime()))]
    .map(t => new Date(t))
    .sort((a, b) => a - b);
  const allHours = [...Array(24).keys()];
  const colorDomain = [
    d3.min(data, d => d.power_kW),
    d3.max(data, d => d.power_kW)
  ];

  // Calculer le base load (5e percentile des valeurs nocturnes 00h-06h)
  //
  // POURQUOI le 5e percentile et pas la mediane :
  //   - La mediane (P50) inclut le chauffage hiver → base load trop haut (~300 kW)
  //   - En ete, la courbe tombe a ~260 kW, SOUS la ligne de base load → incoherent visuellement
  //   - Le 5e percentile capture le process SEUL (sans chauffage, sans pics occasionnels)
  //   - Resultat : ~246 kW → la courbe d'ete (260 kW) reste AU-DESSUS → coherent
  //
  // d3.quantile exige un array TRIE — d'ou le .sort((a, b) => a - b)
  const nightData = data.filter(d => d.timestamp.getHours() >= 0 && d.timestamp.getHours() < 6);
  const baseLoad = d3.quantile(nightData.map(d => d.power_kW).sort((a, b) => a - b), 0.05);

  // 4c. Scales — SWD : axe Y ne commence PAS a 0 (line graph)
  //
  // POURQUOI ne pas commencer a 0 :
  //   - Un line graph montre des VARIATIONS, pas des quantites (contrairement aux bar charts)
  //   - Les donnees vont de ~200 a ~540 kW. Commencer a 0 gaspille 200px sous le base load
  //   - SWD : 70-80% de l'espace vertical doit contenir les donnees
  //
  // On arrondit au multiple de 50 le plus proche pour des axes propres
  const yMin = Math.floor(d3.min(dailyData, d => d.avgkW) * 0.9 / 50) * 50;
  const yMax = Math.ceil(d3.max(dailyData, d => d.avgkW) * 1.1 / 50) * 50;

  // scaleTime : mappe une plage de DATES vers des PIXELS (axe X)
  // domain = [min date, max date] (les bornes des donnees)
  // range = [0, width] (les pixels disponibles)
  // Une scale est une FONCTION : xScale(date) → pixel X
  const xScale = d3.scaleTime()
    .domain(d3.extent(dailyData, d => d.date))
    .range([0, width]);

  // scaleLinear : mappe une plage de VALEURS vers des PIXELS (axe Y)
  // range = [height, 0] INVERSE car en SVG, Y=0 est en HAUT (contrairement aux maths)
  // Sans inversion : les valeurs elevees seraient en bas du chart
  const yScale = d3.scaleLinear()
    .domain([yMin, yMax])
    .range([height, 0]);

  // 4d. Scales pour l'overview (mini-chart de navigation)
  // xScale2 : meme domaine que xScale (toute l'annee), ne change jamais
  // yScale2 : meme domaine que yScale, mais hauteur plus petite (overviewHeight)
  const xScale2 = d3.scaleTime()
    .domain(d3.extent(dailyData, d => d.date))
    .range([0, width]);

  const yScale2 = d3.scaleLinear()
    .domain([yMin, yMax])
    .range([overviewHeight, 0]);

  // 5. Creer le SVG
  // Hauteur totale = margins + chart principal + gap + overview + margins bas
  const svg = d3.select("#chart")
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", margin.top + totalHeight + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // 6. Gridlines subtiles (SWD : declutter)
  // Les gridlines aident a lire les valeurs, mais doivent etre DISCRETES
  // tickSize(-width) : les ticks s'etendent vers la droite (grilles horizontales)
  // tickFormat("") : pas de label (les labels sont sur l'axe Y separé)
  // .domain().remove() : supprime la ligne d'axe (SWD : enlever le clutter)
  svg.append("g")
    .attr("color", COLORS.grid)
    .call(d3.axisLeft(yScale)
      .tickSize(-width)
      .tickFormat("")
      .ticks(6))
    .call(g => g.select(".domain").remove())
    .call(g => g.selectAll(".tick line").attr("stroke", COLORS.grid).attr("stroke-width", 0.5));

  // 7. Ligne de reference : base load (SWD : annotation, pas juste donnees)
  // Une ligne pointillee horizontale a la hauteur du base load
  // stroke-dasharray "4,4" : pointilles (4px tire, 4px espace)
  svg.append("line")
    .attr("class", "base-load-line")
    .attr("x1", 0)
    .attr("x2", width)
    .attr("y1", yScale(baseLoad))
    .attr("y2", yScale(baseLoad))
    .attr("stroke", COLORS.base)
    .attr("stroke-width", 1.5)
    .attr("stroke-dasharray", "4,4")
    .attr("clip-path", "url(#chart-clip)");

  // Label base load (positionne en bas a gauche, sous la ligne, pour ne pas chevaucher la courbe)
  svg.append("text")
    .attr("class", "base-load-label")
    .attr("x", 8)
    .attr("y", yScale(baseLoad) + 16)
    .attr("text-anchor", "start")
    .attr("fill", COLORS.muted)
    .attr("font-size", "11px")
    .text(`Base load : ${baseLoad.toFixed(0)} kW`);

  // 8. Line chart — courbe principale
  // d3.line() genere le path SVG d'une ligne (pas une zone remplie)
  // POURQUOI line et pas area : kW = PUISSANCE INSTANTANEE (un flux), pas une quantite
  //   - Un area chart suggere que l'aire = une quantite (kWh) — incoherent avec kW en axe Y
  //   - Un line chart montre le profil de puissance — c'est la convention industrielle
  //
  // curve(d3.curveMonotoneX) : courbe lisse (pas d'escalier, pas de ligne droite)
  //   - Pas de curveStep : les donnees sont des MOYENNES quotidiennes, pas des valeurs constantes
  //   - Pas de linear (defaut) : trop anguleux pour 365 points
  const line = d3.line()
    .x(d => xScale(d.date))
    .y(d => yScale(d.avgkW))
    .curve(d3.curveMonotoneX);

  // Clip-path : empeche la ligne de sortir de la zone du graphique quand on zoom
  // Sans ceci, les points en dehors du domaine visible debordent sur l'axe Y (gauche)
  svg.append("defs").append("clipPath")
    .attr("id", "chart-clip")
    .append("rect")
    .attr("x", 0)
    .attr("y", 0)
    .attr("width", width)
    .attr("height", height);

  // Dessiner la ligne
  // .datum(data) : attache les donnees a l'element (singulier, pas de data join)
  // .attr("d", line) : D3 appelle line(data) et met le path SVG dans l'attribut "d"
  // class="line-chart" : pour selectionner cet element dans la fonction update (brush)
  svg.append("path")
    .datum(dailyData)
    .attr("class", "line-chart")
    .attr("fill", "none")
    .attr("stroke", COLORS.primary)
    .attr("stroke-width", 2)
    .attr("clip-path", "url(#chart-clip)")
    .attr("d", line);

  // 8b. Point max (SWD : mettre en evidence les points cles)
  // reduce trouve le jour avec la moyenne quotidienne la plus elevee
  const maxPoint = dailyData.reduce((a, b) => a.avgkW > b.avgkW ? a : b);

  // Cercle orange sur le pic
  // class="pic-circle" : pour selectionner dans la fonction update (brush)
  // clip-path : empeche le cercle de sortir de la zone quand on zoom
  svg.append("circle")
    .attr("class", "pic-circle")
    .attr("cx", xScale(maxPoint.date))
    .attr("cy", yScale(maxPoint.avgkW))
    .attr("r", 4)
    .attr("fill", COLORS.accent)
    .attr("clip-path", "url(#chart-clip)");

  // Label du pic (valeur + date)
  // class="pic-label" : pour selectionner dans la fonction update (brush)
  svg.append("text")
    .attr("class", "pic-label")
    .attr("x", xScale(maxPoint.date))
    .attr("y", yScale(maxPoint.avgkW) - 12)
    .attr("text-anchor", "middle")
    .attr("fill", COLORS.accent)
    .attr("font-size", "11px")
    .attr("font-weight", "bold")
    .attr("clip-path", "url(#chart-clip)")
    .text(`Pic : ${maxPoint.avgkW.toFixed(0)} kW`);

  // 9. Axe X (SWD : declutter — ticks minimalistes, pas de ligne d'axe)
  // axisBottom : axe en bas du chart
  // tickFormat(d3.timeFormat("%b")) : affiche les mois abreges (Jan, Feb, Mar...)
  //   - d3.timeFormat est l'INVERSE de d3.timeParse : Date → string (pour l'affichage)
  //   - %b = mois abrège (Jan, Feb...) | %B = mois complet (January) | %m = 01-12
  // .domain().remove() : supprime la ligne d'axe (SWD : enlever le clutter)
  // class="x-axis" : pour selectionner cet element dans la fonction update (brush)
  svg.append("g")
    .attr("class", "x-axis")
    .attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(xScale)
      .tickFormat(d3.timeFormat("%b"))
      .tickSize(5))
    .call(g => g.select(".domain").remove())
    .attr("color", COLORS.muted);

  // 10. Axe Y (SWD : declutter — pas de ligne d'axe, juste les labels)
  // tickSize(0) : pas de ticks, juste les labels
  svg.append("g")
    .call(d3.axisLeft(yScale)
      .tickSize(0)
      .ticks(6))
    .call(g => g.select(".domain").remove())
    .attr("color", COLORS.muted)
    .attr("font-size", "11px");

  // 10b. Label axe Y (rotation -90deg pour le mettre verticalement)
  svg.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -height / 2)
    .attr("y", -50)
    .attr("text-anchor", "middle")
    .attr("fill", COLORS.muted)
    .attr("font-size", "12px")
    .text("Puissance moyenne (kW)");

  // 11. Titre narratif (SWD : le titre raconte une HISTOIRE, pas juste un label)
  // MAUVAIS : "Courbe de charge 2023" (descriptif — le lecteur doit deviner l'insight)
  // BON : "Process continu + chauffage hiver = 2 postes distincts" (narratif — l'insight est immediat)
  svg.append("text")
    .attr("x", 0)
    .attr("y", -35)
    .attr("fill", COLORS.text)
    .attr("font-size", "16px")
    .attr("font-weight", "bold")
    .text("Process continu + chauffage hiver = 2 postes distincts");

  // 11b. Sous-titre (contexte — qui, quoi, quand)
  svg.append("text")
    .attr("x", 0)
    .attr("y", -15)
    .attr("fill", COLORS.muted)
    .attr("font-size", "12px")
    .text("Courbe de charge 2023 — puissance moyenne quotidienne (kW)");

  // ========================================================================
  // 11c. TOOLTIP — hover interactif (SWD : interactivité = exploration)
  // ========================================================================
  // Un tooltip est un <div> HTML positionné à la souris.
  // D3 n'en fournit pas — on le construit soi-même.
  //
  // Le flux :
  // 1. Rectangle transparent par-dessus le chart (capte les events souris)
  // 2. Sur mousemove : bisector trouve le point le plus proche
  // 3. Afficher le tooltip (date + kW) à la position de la souris
  // 4. Sur mouseout : cacher le tooltip
  //
  // Concept clé — d3.bisector() :
  //   Convertit "position souris en pixels" → "point de données le plus proche"
  //   bisector(d => d.date).left : retourne l'index d'insertion à gauche
  // ========================================================================

  // Selectionner le div tooltip créé dans index.html
  const tooltip = d3.select("#tooltip");

  // Créer un bisector sur les dates (les données sont triées par date)
  // .left : retourne l'index du point <= la valeur recherchée
  const bisect = d3.bisector(d => d.date).left;

  // Rectangle transparent par-dessus tout le chart
  // fill = "none" (invisible) MAIS pointer-events = "all" (capte quand même la souris)
  // C'est l'astuce : un rectangle invisible qui capte les events
  svg.append("rect")
    .attr("width", width)
    .attr("height", height)
    .attr("fill", "none")
    .attr("pointer-events", "all")
    .on("mousemove", function(event) {
      // 1. Position de la souris relative au chart (en pixels)
      // d3.pointer(event) retourne [x, y] dans le repère de l'élément
      const [mx, my] = d3.pointer(event);

      // 2. Convertir pixel X → Date (inverse du scale)
      // xScale.invert() fait l'inverse de xScale() : pixel → donnée
      const mouseDate = xScale.invert(mx);

      // 3. Trouver l'index du point le plus proche avec le bisector
      const i = bisect(dailyData, mouseDate);

      // 4. Sécurité : ne pas dépasser les bornes du tableau
      if (i < 0 || i >= dailyData.length) return;
      const d = dailyData[i];

      // 5. Formater la date et la valeur pour l'affichage
      // d3.timeFormat("%d %b") : "27 Feb"
      const dateStr = d3.timeFormat("%d %b")(d.date);
      const kW = d.avgkW.toFixed(0);

      // 6. Remplir le tooltip avec HTML
      tooltip.html(`<strong>${dateStr}</strong><br>Puissance : ${kW} kW`);

      // 7. Positionner le tooltip près de la souris (coords absolues de la page)
      // getBoundingClientRect() : position du conteneur chart dans la page
      // On ajoute margin.left (décalage du <g> SVG) + mx (position souris) + 15 (offset)
      const chartRect = document.getElementById("chart").getBoundingClientRect();
      tooltip
        .style("left", (chartRect.left + margin.left + mx + 15) + "px")
        .style("top", (chartRect.top + margin.top + my - 10) + "px")
        .style("opacity", 1);
    })
    .on("mouseout", function() {
      // Cacher le tooltip quand la souris quitte le chart
      tooltip.style("opacity", 0);
    });

  // ========================================================================
  // 11d. BRUSH — zoom par sélection (overview + detail)
  // ========================================================================
  // Pattern "overview + detail" :
  //   - Un mini-chart (overview) en bas montre toute l'année
  //   - L'utilisateur dessine une sélection dessus (brush)
  //   - Le chart principal zoome sur la période sélectionnée
  //
  // Concept clé — d3.brushX() :
  //   Crée un rectangle de sélection horizontal.
  //   .on("brush end", handler) : se déclenche quand la sélection change.
  //   Le handler reçoit la sélection en PIXELS qu'on convertit en DATES
  //   via xScale2.invert(), puis on met à jour xScale.domain() du chart principal.
  //
  // La fonction update() :
  //   Met à jour le domain de xScale, puis redessine la ligne et l'axe X.
  //   C'est le pattern "update" de D3 : on ne détruit pas, on met à jour.
  // ========================================================================

  // Groupe pour l'overview (positionné en bas, après le chart principal + gap)
  const overview = svg.append("g")
    .attr("transform", `translate(0,${height + overviewGap})`);

  // Line simplifiée dans l'overview (courbe d'aperçu)
  const overviewLine = d3.line()
    .x(d => xScale2(d.date))
    .y(d => yScale2(d.avgkW))
    .curve(d3.curveMonotoneX);

  overview.append("path")
    .datum(dailyData)
    .attr("fill", "none")
    .attr("stroke", COLORS.primary)
    .attr("stroke-width", 1)
    .attr("opacity", 0.5)
    .attr("d", overviewLine);

  // Créer le brush (d3.brushX = sélection horizontale)
  // extent : zone où le brush est actif (toute la largeur, hauteur de l'overview)
  const brush = d3.brushX()
    .extent([[0, 0], [width, overviewHeight]])
    .on("brush end", brushed);

  // Ajouter le brush sur l'overview
  overview.append("g")
    .attr("class", "brush")
    .call(brush)
    // Sélection initiale : toute l'année (le brush recouvre tout au démarrage)
    .call(brush.move, [0, width]);

  // Fonction appelée quand le brush change (sélection ou zoom)
  // event.selection : [pixelStart, pixelEnd] en coords overview (ou null si vidé)
  function brushed({ selection }) {
    // Si la sélection est vide (l'utilisateur a cliqué en dehors), ne rien faire
    if (!selection) return;

    // 1. Convertir les pixels de l'overview en dates (via xScale2)
    const [pxStart, pxEnd] = selection;
    const dateStart = xScale2.invert(pxStart);
    const dateEnd = xScale2.invert(pxEnd);

    // Stocker la periode zoomee pour l'analyse IA (au clic) et les donnees filtrees
    zoomRange = { start: dateStart, end: dateEnd };
    zoomedDailyData = dailyData.filter(d => d.date >= dateStart && d.date <= dateEnd);

    // 2. Mettre a jour le domain du chart principal (zoome sur la periode)
    xScale.domain([dateStart, dateEnd]);

    // 3. Redessiner la ligne (update du path avec le nouveau scale)
    // Le clip-path empeche la ligne de sortir de la zone du graphique
    svg.select(".line-chart").attr("d", line);

    // 4. Redessiner l'axe X (les ticks changent avec le nouveau domain)
    svg.select(".x-axis")
      .call(d3.axisBottom(xScale)
        .tickFormat(d3.timeFormat("%b"))
        .tickSize(5))
      .call(g => g.select(".domain").remove())
      .attr("color", COLORS.muted);

    // 5. Recalculer le pic sur la periode zoomee (pas l'annee complete)
    const zoomedMaxPoint = zoomedDailyData.length > 0
      ? zoomedDailyData.reduce((a, b) => a.avgkW > b.avgkW ? a : b)
      : maxPoint;

    svg.select(".pic-circle")
      .attr("cx", xScale(zoomedMaxPoint.date))
      .attr("cy", yScale(zoomedMaxPoint.avgkW));

    svg.select(".pic-label")
      .attr("x", xScale(zoomedMaxPoint.date))
      .attr("y", yScale(zoomedMaxPoint.avgkW) - 12)
      .text(`Pic : ${zoomedMaxPoint.avgkW.toFixed(0)} kW`);

    // 6. Recalculer le base load sur la periode zoomee (P5 des nuits 00h-06h)
    const zoomedNightData = data.filter(
      d => d.timestamp >= dateStart &&
           d.timestamp <= dateEnd &&
           d.timestamp.getHours() >= 0 &&
           d.timestamp.getHours() < 6
    );
    const zoomedBaseLoad = zoomedNightData.length > 0
      ? d3.quantile(zoomedNightData.map(d => d.power_kW).sort((a, b) => a - b), 0.05)
      : baseLoad;

    svg.select(".base-load-line")
      .attr("y1", yScale(zoomedBaseLoad))
      .attr("y2", yScale(zoomedBaseLoad));

    svg.select(".base-load-label")
      .attr("y", yScale(zoomedBaseLoad) + 16)
      .text(`Base load : ${zoomedBaseLoad.toFixed(0)} kW`);

    // 7. Synchroniser la heatmap avec la periode zoomee
    renderHeatmap(dateStart, dateEnd);
  }

  // ========================================================================
  // =================================================================
  // 11e. HEATMAP CALENDRIER jour×heure (zoomable via le brush)
  // =================================================================
  // Cette heatmap est synchronisee avec le brush de la courbe principale.
  // Quand on zoome, renderHeatmap() est rappelee avec la periode selectionnee.
  //
  // Layout :
  //   X = jours de la periode (variable)
  //   Y = heures de la journee (24 lignes)
  //   Couleur = puissance (clair = base load, fonce = pic)
  // =================================================================

  function renderHeatmap(startDate, endDate) {
    // Vider la heatmap precedente
    d3.select("#heatmap").selectAll("*").remove();

    // Dimensions de la heatmap
    const hmMargin = { top: 50, right: 20, bottom: 40, left: 50 };
    const hmWidth = 900 - hmMargin.left - hmMargin.right;
    const hmHeight = 300 - hmMargin.top - hmMargin.bottom;

    // Filtrer les jours et les donnees sur la periode
    const filteredDays = allDays.filter(d => d >= d3.timeDay(startDate) && d <= d3.timeDay(endDate));
    const filteredData = data.filter(d => d.timestamp >= startDate && d.timestamp <= endDate);

    // Scales
    const hmXScale = d3.scaleBand()
      .domain(filteredDays)
      .range([0, hmWidth])
      .padding(0.02);

    const hmYScale = d3.scaleBand()
      .domain(allHours)
      .range([0, hmHeight])
      .padding(0);

    const hmColorScale = d3.scaleSequential()
      .domain(colorDomain)
      .interpolator(d3.interpolateInferno);

    // SVG
    const hmSvg = d3.select("#heatmap")
      .append("svg")
      .attr("width", hmWidth + hmMargin.left + hmMargin.right)
      .attr("height", hmHeight + hmMargin.top + hmMargin.bottom)
      .append("g")
      .attr("transform", `translate(${hmMargin.left},${hmMargin.top})`);

    // Cellules
    hmSvg.selectAll("rect")
      .data(filteredData)
      .join("rect")
      .attr("x", d => hmXScale(d3.timeDay(d.timestamp)))
      .attr("y", d => hmYScale(d.timestamp.getHours()))
      .attr("width", hmXScale.bandwidth())
      .attr("height", hmYScale.bandwidth())
      .attr("fill", d => hmColorScale(d.power_kW))
      .attr("stroke", "none")
      .attr("rx", 0);

    // Axe X : mois
    const hmXAxisScale = d3.scaleTime()
      .domain([d3.timeDay(startDate), d3.timeDay(endDate)])
      .range([0, hmWidth]);

    hmSvg.append("g")
      .attr("transform", `translate(0,${hmHeight})`)
      .call(d3.axisBottom(hmXAxisScale)
        .tickFormat(d3.timeFormat("%b"))
        .tickSize(5))
      .call(g => g.select(".domain").remove())
      .attr("color", COLORS.muted);

    // Axe Y : heures
    const hourLabels = {
      0: "00h", 3: "03h", 6: "06h", 9: "09h", 12: "12h", 15: "15h", 18: "18h", 21: "21h"
    };

    hmSvg.append("g")
      .call(d3.axisLeft(hmYScale)
        .tickSize(0)
        .tickFormat(h => hourLabels[h] || ""))
      .call(g => g.select(".domain").remove())
      .attr("color", COLORS.muted)
      .attr("font-size", "10px");

    // Titre
    hmSvg.append("text")
      .attr("x", 0)
      .attr("y", -15)
      .attr("fill", COLORS.text)
      .attr("font-size", "14px")
      .attr("font-weight", "bold")
      .text("Heatmap heure par heure — les 8760 points révélés");

    // Legende
    const legendWidth = 150;
    const legendHeight = 12;
    const defs = hmSvg.append("defs");
    const gradient = defs.append("linearGradient")
      .attr("id", "heatmap-legend-gradient")
      .attr("x1", "0%").attr("y1", "0%")
      .attr("x2", "100%").attr("y2", "0%");

    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      gradient.append("stop")
        .attr("offset", `${t * 100}%`)
        .attr("stop-color", hmColorScale(colorDomain[0] + t * (colorDomain[1] - colorDomain[0])));
    }

    const legendX = hmWidth - legendWidth - 10;
    const legendY = -35;

    hmSvg.append("rect")
      .attr("x", legendX)
      .attr("y", legendY)
      .attr("width", legendWidth)
      .attr("height", legendHeight)
      .attr("fill", "url(#heatmap-legend-gradient)")
      .attr("rx", 2);

    hmSvg.append("text")
      .attr("x", legendX)
      .attr("y", legendY - 4)
      .attr("text-anchor", "start")
      .attr("fill", COLORS.muted)
      .attr("font-size", "10px")
      .text(`${colorDomain[0].toFixed(0)} kW`);

    hmSvg.append("text")
      .attr("x", legendX + legendWidth)
      .attr("y", legendY - 4)
      .attr("text-anchor", "end")
      .attr("fill", COLORS.muted)
      .attr("font-size", "10px")
      .text(`${colorDomain[1].toFixed(0)} kW`);
  }

  // Affichage initial : toute l'annee
  renderHeatmap(d3.min(allDays), d3.max(allDays));
  // 12. KPIs pour l'analyse IA — calcules au clic, sur la periode ZOOME
  // ========================================================================
  // L'analyse IA de la courbe est declenchee manuellement au clic.
  // Quand l'utilisateur appuie sur le bouton IA, l'analyse porte sur la
  // periode actuellement selectionnee par le brush. Le zoom lui-meme ne
  // relance pas l'analyse automatiquement.

  // Fonction : calculer les KPIs sur une periode filtree
  function computeZoomedKPIs(startDate, endDate) {
    // Filtrer les donnees horaires sur la periode zoome
    const zoomedData = data.filter(d => d.timestamp >= startDate && d.timestamp <= endDate);
    // Filtrer les donnees quotidiennes sur la periode zoome
    const zoomedDaily = dailyData.filter(d => d.date >= d3.timeDay(startDate) && d.date <= d3.timeDay(endDate));

    if (zoomedData.length === 0) return null;

    // Base load sur la periode zoome
    const zoomedNight = zoomedData.filter(d => d.timestamp.getHours() >= 0 && d.timestamp.getHours() < 6);
    const zoomedBaseLoad = zoomedNight.length > 0
      ? d3.quantile(zoomedNight.map(d => d.power_kW).sort((a, b) => a - b), 0.05)
      : 0;

    // Pic sur la periode zoome
    const zoomedMax = zoomedDaily.length > 0
      ? zoomedDaily.reduce((a, b) => a.avgkW > b.avgkW ? a : b)
      : { date: startDate, avgkW: 0 };

    // Periode en jours
    const periodDays = Math.round((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
    const periodLabel = periodDays > 360 ? "annee complete"
      : periodDays > 60 ? `${Math.round(periodDays / 30)} mois`
      : `${periodDays} jours`;

    return {
      mean: d3.mean(zoomedData, d => d.power_kW),
      max: zoomedMax.avgkW,
      maxDate: zoomedMax.date,
      baseLoad: zoomedBaseLoad,
      totalKWh: d3.sum(zoomedData, d => d.power_kW),
      baseLoadShare: (zoomedBaseLoad * zoomedData.length) / d3.sum(zoomedData, d => d.power_kW),
      periodLabel,
      periodDays,
      startDate,
      endDate
    };
  }

  // 13. Fonction : construire le prompt avec les KPIs de la periode actuellement zoomee
  // L'analyse n'est declenchee que manuellement, au clic sur le bouton IA.
  function buildAiPrompt() {
    const k = computeZoomedKPIs(zoomRange.start, zoomRange.end);
    if (!k) return null;

    return `Tu es un expert en analyse énergétique industrielle. Voici les KPIs d'une PME industrielle wallonne (données horaires réelles ELMAS, periode: ${k.periodLabel}).

KPIs :
- Puissance moyenne : ${k.mean.toFixed(0)} kW
- Pic : ${k.max.toFixed(0)} kW le ${k.maxDate.toLocaleDateString("fr-FR")}
- Base load (P5 nuits) : ${k.baseLoad.toFixed(0)} kW
- Consommation totale : ${k.totalKWh.toLocaleString("fr-FR")} kWh
- Part base load : ${(k.baseLoadShare * 100).toFixed(0)}%

Réponds en français, en 3 points MAXIMUM, 1 phrase par point. Format : **Titre** : constat. Sois direct, concret, pas de tutoiement, pas d'emojis.`;
  }

  // 13b. Bouton toggle pour l'analyse IA de la courbe
  // L'analyse se lance au clic avec les KPIs de la periode ZOOME actuelle
  let aiLaunched = false;
  const toggleBtn = document.getElementById("toggle-ai-btn");
  const toggleIcon = document.getElementById("toggle-ai-icon");
  aiPanel = document.getElementById("ai-panel");

  toggleBtn.addEventListener("click", () => {
    aiPanel.classList.toggle("hidden");
    if (aiPanel.classList.contains("hidden")) {
      toggleIcon.textContent = "+ IA Courbe";
    } else {
      toggleIcon.textContent = "- IA Courbe";
      // Construire le prompt avec les KPIs de la periode zoomee actuelle
      const prompt = buildAiPrompt();
      if (prompt) {
        // Relancer l'analyse a chaque ouverture (les KPIs peuvent avoir change si zoom)
        callOllama(prompt, "ai-analysis");
      }
    }
  });

  // ========================================================================
  // 13c. Analyse IA pour la HEATMAP (prompt court)
  // ========================================================================

  // KPIs spécifiques à la heatmap (patterns horaires)
  const weekdayDaytime = data.filter(d => d.timestamp.getDay() >= 1 && d.timestamp.getDay() <= 5 && d.timestamp.getHours() >= 8 && d.timestamp.getHours() < 18);
  const weekendData = data.filter(d => d.timestamp.getDay() >= 6);
  const weekdayDayAvg = d3.mean(weekdayDaytime, d => d.power_kW);
  const weekendAvg = d3.mean(weekendData, d => d.power_kW);
  const nightAvg = d3.mean(data.filter(d => d.timestamp.getHours() >= 0 && d.timestamp.getHours() < 6), d => d.power_kW);
  const peakHours = d3.rollups(data, v => d3.mean(v, d => d.power_kW), d => d.timestamp.getHours())
    .sort((a, b) => b[1] - a[1]).slice(0, 3);

  const hmAiPrompt = `Tu es un expert en analyse énergétique industrielle. Voici les patterns horaires d'une PME industrielle wallonne (heatmap jour×heure, données ELMAS réelles).

Patterns détectés :
- Heure la plus chargée : ${peakHours[0][0]}h (${peakHours[0][1].toFixed(0)} kW)
- Heure la moins chargée : ${d3.rollups(data, v => d3.mean(v, d => d.power_kW), d => d.timestamp.getHours()).sort((a, b) => a[1] - b[1])[0][0]}h
- Semaine jour : ${weekdayDayAvg.toFixed(0)} kW | Week-end : ${weekendAvg.toFixed(0)} kW
- Nuit (00-06h) : ${nightAvg.toFixed(0)} kW
- Écart semaine/WE : ${((weekdayDayAvg - weekendAvg) / weekdayDayAvg * 100).toFixed(0)}%

Réponds en français, en 3 points MAXIMUM, 1 phrase par point. Format : **Titre** : constat. Sois direct, concret, pas de tutoiement, pas d'emojis.`;

  // Bouton toggle pour l'analyse IA de la heatmap
  let hmAiLaunched = false;
  const hmToggleBtn = document.getElementById("toggle-hm-ai-btn");
  const hmToggleIcon = document.getElementById("toggle-hm-ai-icon");
  const hmAiPanel = document.getElementById("hm-ai-panel");

  hmToggleBtn.addEventListener("click", () => {
    hmAiPanel.classList.toggle("hidden");
    if (hmAiPanel.classList.contains("hidden")) {
      hmToggleIcon.textContent = "+ IA Heatmap";
    } else {
      hmToggleIcon.textContent = "- IA Heatmap";
      if (!hmAiLaunched) {
        hmAiLaunched = true;
        callOllama(hmAiPrompt, "hm-ai-analysis");
      }
    }
  });
});

// ============================================================================
// 14. Fonction : appeler Ollama en streaming et afficher le resultat
// targetId : ID du div où afficher le texte (ex: "ai-analysis" ou "hm-ai-analysis")
// ============================================================================
async function callOllama(prompt, targetId) {
  const analysisDiv = document.getElementById(targetId);
  analysisDiv.innerHTML = '<p class="text-slate-400 italic">Analyse en cours...</p>';

  try {
    const response = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "qwen2.5:7b",
        prompt: prompt,
        stream: true,
      }),
    });

    // Lire le stream : Ollama renvoie du JSON ligne par ligne
    // Chaque ligne : {"response": "mot ", "done": false}
    // Derniere ligne : {"response": "", "done": true}
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = "";
    let buffer = "";  // buffer pour les lignes incompletes (le stream ne respecte pas les \n)

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop();  // garder la derniere ligne (potentiellement incomplete)

      for (const line of lines) {
        if (line.trim()) {
          const json = JSON.parse(line);
          if (json.response) {
            fullText += json.response;
            // Rendre le markdown simple (gras) en HTML a chaque token
            analysisDiv.innerHTML = renderMarkdown(fullText);
          }
        }
      }
    }
  } catch (error) {
    // Ollama non accessible (non lance, port different, etc.)
    analysisDiv.innerHTML = `<p class="text-red-500">Erreur : Ollama non accessible. Lance Ollama avec : <code class="bg-gray-100 px-1 rounded">ollama serve</code></p>`;
    console.error("Ollama error:", error);
  }
}

// 15. Rendu markdown minimaliste (juste les **gras** et les paragraphes)
// On split par double newline (paragraphes) puis on remplace **texte** par <strong>
// Pas de librairie markdown — on reste leger pour le MVP
function renderMarkdown(text) {
  return text
    .split("\n\n")
    .map(para =>
      `<p class="mb-3">${para.replace(/\*\*(.+?)\*\*/g, '<strong class="text-slate-800">$1</strong>')}</p>`
    )
    .join("");
}
