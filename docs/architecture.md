# Architecture — Wattscope

## Stack technique

| Couche | Choix | Raison | Statut |
|---|---|---|---|
| **Viz** | D3.js v7 (vanilla, CDN) | Contrôle total, différenciation, transférable | Actif |
| **Style** | Tailwind CSS (CDN) | Rapide, pas de CSS à écrire | Actif (dev only) |
| **IA** | Ollama qwen2.5:7b (local) | Gratuit, privé, offline, streaming | Actif |
| **Backend** | FastAPI (Python, uv) | Simple, parfait pour KPIs | Pas encore |
| **DB** | PostgreSQL | Persistance diagnostics | Pas encore |
| **PDF** | WeasyPrint | HTML→PDF, template simple | Pas encore |
| **Prod** | Coolify + Cloudflare Tunnel | Homelab, auto-hébergé | Pas encore |

## Décisions clés

### 1. D3.js vanilla, pas de React/Next.js au démarrage

**Pourquoi** : D3 demande de comprendre les scales, data joins, SVG. React masque ça. On apprend les fondamentaux D3 d'abord, on migre vers Next.js en phase 6 quand le produit est solide.

### 2. Line chart, pas area chart pour la puissance

**Pourquoi** : kW = puissance instantanée (un flux). L'aire sous la courbe suggère une quantité (kWh). Incohérent avec kW en axe Y. Convention industrielle = line chart pour courbe de charge. On garde l'area chart pour l'énergie cumulée (kWh) plus tard.

### 3. Agrégation quotidienne (365 points), pas horaire (8760)

**Pourquoi** : 8760 points sur 790px = 11 points par pixel = illisible. On agrège par jour avec `d3.rollups()` (moyenne quotidienne). Les données horaires brutes seront montrées dans la heatmap calendrier (étape 7).

### 4. Base load = 5e percentile des nuits, pas médiane

**Pourquoi** : la médiane (P50) inclut le chauffage hiver (~300 kW). En été, la courbe tombe à ~260 kW, sous la ligne de base load → incohérent. Le 5e percentile capture le process seul (sans chauffage, sans pics) → ~246 kW. La courbe d'été reste au-dessus.

### 5. Axe Y ne commence pas à 0

**Pourquoi** : un line graph montre des variations, pas des quantités (contrairement aux bar charts). Les données vont de 200 à 540 kW. Commencer à 0 gaspille 200px. Principe SWD : 70-80% de l'espace vertical pour les données.

### 6. IA optionnelle (toggle, pas automatique)

**Pourquoi** : l'analyse Ollama prend ~20-30s et occupe de l'espace. On la rend optionnelle avec un bouton toggle. Lancée une seule fois au premier clic (flag `aiLaunched`).

## Structure du code

### index.html

- CDN : D3 v7 + Tailwind
- Layout : flex deux colonnes (chart + panneau IA)
- Bouton toggle pour l'IA
- `<div id="chart">` : D3 injecte le SVG ici
- `<div id="ai-analysis">` : Ollama remplit ce div en streaming

### js/main.js

Flux principal (dans `d3.csv().then()`) :
1. Charger le CSV → convertir types (Date + number)
2. Aggréger par jour (`d3.rollups`)
3. Calculer base load (`d3.quantile` P5)
4. Créer scales (`scaleTime`, `scaleLinear`)
5. Créer SVG + groupe avec marges
6. Dessiner gridlines, ligne base load, line chart, point pic
7. Dessiner axes X/Y (declutter SWD)
8. Ajouter titre narratif + sous-titre
9. Calculer KPIs pour l'IA
10. Configurer le bouton toggle IA

Fonctions hors `d3.csv().then()` :
- `callOllama(prompt)` : fetch POST vers Ollama, lecture stream
- `renderMarkdown(text)` : rendu markdown minimaliste (gras + paragraphes)

## Palette de couleurs

| Nom | Hex | Usage |
|---|---|---|
| primary | #0f4c5c | Courbe principale (teal foncé) |
| base | #94a3b8 | Base load (gris, secondaire) |
| accent | #e76f51 | Pic / anomalie (orange) |
| grid | #e5e7eb | Gridlines (gris très clair) |
| text | #1e293b | Texte principal |
| muted | #64748b | Labels secondaires |

## Données

### sample.csv

Généré par `generate_sample.py`. Profil type PME industrielle wallonne :
- Base load ~300 kW (process continu)
- Pic jour (~500 kW) en semaine 8h-18h
- Saisonnalité hiver (+120 kW) / été (-40 kW)
- Bruit gaussien (±15 kW) + variation lente + pics occasionnels

Format : `timestamp,power_kW` (8760 lignes, horaire, 2023)

## Migration future (phase 6)

| Étape | Changement |
|---|---|
| Next.js | Migration D3 vanilla → composants React, App Router, BetterAuth |
| Tailwind | CDN → PostCSS plugin (prod) |
| Backend | FastAPI pour KPIs, ELMAS, leviers, PDF |
| DB | PostgreSQL pour persister diagnostics |
| Déploiement | Coolify + Cloudflare Tunnel → wattscope.anthemion.dev |
