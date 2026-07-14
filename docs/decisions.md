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

## 2026-07-13 — D05 : Axe Y commence à 0

**Contexte** : axe Y du line chart (puissance kW).

**Décision** : domaine `[0, ~750]`.

**Raison** : donner une référence absolue de la puissance. Même si SWD recommande souvent un axe Y non-zero pour les line charts, le test utilisateur a montré que commencer à 0 aide à lire l'amplitude réelle des pics par rapport au base load.

**Trade-off** : les variations fines sont moins visibles, mais la lecture est plus intuitive pour un non-spécialiste.

---

## 2026-07-13 — D06 : IA manuelle, déclenchée à chaque clic, sur la période zoomée

**Contexte** : panneaux d'analyse narrative par Ollama qwen2.5:7b pour la courbe et la heatmap.

**Décision** : les boutons "Analyser Courbe" et "Analyser Heatmap" relancent l'analyse à chaque clic. L'analyse porte sur la période actuellement zoomée par le brush.

**Raison** : relancer l'IA automatiquement à chaque mouvement de brush est pénalisant (latence, requêtes inutiles) et ne donne pas d'insights actionnables à l'échelle zoomée. L'utilisateur garde le contrôle : il zoome pour explorer, puis clique quand il veut une analyse sur cette période.

**Trade-off** : l'utilisateur doit cliquer explicitement. Les labels des boutons ont été changés de "+/- IA" à "Analyser ..." pour refléter ce comportement.

---

## 2026-07-14 — D07 : Zoom synchronisé entre courbe et heatmap

**Contexte** : brush sur la courbe principale.

**Décision** : le brush de la courbe met à jour simultanément la courbe (pic, base load, axe X) et la heatmap. L'axe X s'adapte au niveau de zoom : mois pour la vue annuelle, jours pour les vues mensuelles/hebdomadaires.

**Raison** : l'overview + detail est le pattern standard pour explorer une série temporelle. La heatmap zoomée révèle les patterns horaires de la période sélectionnée.

**Trade-off** : redessiner la heatmap à chaque zoom demande plus de calcul que la courbe, mais reste fluide sur 8760 points.

---

## 2026-07-14 — D08 : Mode sombre via variables CSS et classes Tailwind

**Contexte** : demande utilisateur pour un mode sombre.

**Décision** : toggle en haut à droite. Le thème est appliqué via une classe `dark` sur `<html>`, des classes Tailwind `dark:` pour l'UI, et des variables CSS pour les couleurs D3.

**Raison** : les variables CSS permettent de changer les couleurs des SVG sans redessiner les charts. Tailwind gère le reste de l'interface. Le choix est persisté dans `localStorage`.

**Trade-off** : le CDN Tailwind en mode `class` nécessite une petite config inline. En production on configurera `darkMode: 'class'` proprement dans `tailwind.config.js`.
