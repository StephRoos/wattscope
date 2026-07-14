# Décisions — Wattscope

> Journal des arbitrages techniques et produit (ADR — Architecture Decision Records).

## 2026-07-13 — D01 : D3.js vanilla, pas de React au démarrage

**Contexte** : choix de stack pour le frontend Wattscope.

**Décision** : D3.js vanilla (HTML + JS + Tailwind CDN), pas de React/Next.js au démarrage.

**Raison** : D3 demande de comprendre les scales, data joins, SVG. React masque ces concepts. On apprend les fondamentaux D3 d'abord, on migre vers Next.js en phase 6 quand le produit est solide visuellement.

**Trade-off** : plus de boilerplate maintenant, mais maîtrise réelle de D3 (transférable vers n'importe quelle autre lib).

---

## 2026-07-13 — D02 : Line chart, pas area chart pour la puissance

**Contexte** : représentation de la courbe de charge (kW vs temps).

**Décision** : line chart (`d3.line()`), pas area chart (`d3.area()`).

**Raison** : kW = puissance instantanée (un flux). L'aire sous la courbe suggère visuellement une quantité (kWh), ce qui est incohérent avec kW en axe Y. Convention industrielle = line chart pour courbe de charge. On gardera l'area chart pour l'énergie cumulée (kWh) plus tard.

**Trade-off** : moins visuel qu'une zone remplie, mais cohérent physiquement.

---

## 2026-07-13 — D03 : Agrégation quotidienne (365 points), pas horaire (8760)

**Contexte** : 8760 points horaires sur 790px de largeur.

**Décision** : aggréger par jour avec `d3.rollups()` (moyenne quotidienne → 365 points).

**Raison** : 8760 points sur 790px = 11 points par pixel = illisible (mur de pixels). 365 points = 2.2px par point = lisible. Les données horaires brutes seront montrées dans la heatmap calendrier (étape 7).

**Trade-off** : on perd la variation horaire dans cette vue, mais on la retrouve dans la heatmap.

---

## 2026-07-13 — D04 : Base load = 5e percentile des nuits, pas médiane

**Contexte** : calcul du base load (consommation minimale du site, process continu).

**Décision** : 5e percentile des valeurs nocturnes (00h-06h), pas médiane.

**Raison** : la médiane (P50) inclut le chauffage hiver (~300 kW). En été, la courbe tombe à ~260 kW, sous la ligne de base load → incohérent visuellement. Le 5e percentile capture le process seul (sans chauffage, sans pics occasionnels) → ~246 kW. La courbe d'été reste au-dessus.

**Trade-off** : le 5e percentile est plus sensible aux valeurs extrêmement basses (capteurs en panne), mais c'est rare et l'inspection visuelle le détecte.

---

## 2026-07-13 — D05 : Axe Y ne commence pas à 0

**Contexte** : axe Y du line chart (puissance kW).

**Décision** : domaine `[~150, ~750]` au lieu de `[0, 800]`.

**Raison** : un line graph montre des variations, pas des quantités (contrairement aux bar charts où le 0 est obligatoire). Les données vont de 200 à 540 kW. Commencer à 0 gaspille 200px sous le base load. Principe SWD : 70-80% de l'espace vertical pour les données.

**Trade-off** : pourrait tromper un lecteur non averti sur l'amplitude des variations. Mitigation : le titre narratif et les annotations donnent le contexte.

---

## 2026-07-13 — D06 : IA optionnelle (toggle, pas automatique)

**Contexte** : panneau d'analyse narrative par Ollama qwen2.5:7b.

**Décision** : bouton toggle pour afficher/masquer le panneau. L'analyse ne se lance qu'au premier clic (flag `aiLaunched`).

**Raison** : l'analyse prend ~20-30s et occupe 384px de large. Rendre optionnel préserve l'espace et évite d'attendre au chargement de la page.

**Trade-off** : un utilisateur qui ne clique pas ne voit pas l'analyse. Mitigation : le bouton est visible en haut à droite.
