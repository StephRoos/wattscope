# Plan de développement — Wattscope

> Frontend-first : on construit la viz avant le backend. On voit quelque chose tout de suite, on apprend D3.js sur du vrai contenu, et le backend vient nourrir la viz quand elle est solide.

## Dualité produit — Diagnostic + Monitoring

Wattscope couvre deux besoins complémentaires mais distincts :

| | Wattscope Diagnostic | Wattscope Monitoring |
|---|---|---|
| **Quand** | One-shot, 2-3 jours | En continu, après le diagnostic |
| **Prix** | 1500-2000€ fixe (mission consulting) | Abonnement mensuel (récurrent) |
| **Viz** | D3.js custom (différenciation, apprentissage) | Grafana pragmatique (standard, ops) |
| **Valeur** | "Où est l'argent sur la table" | "Surveiller que ça ne dérape" |
| **Données** | Un CSV uploadé (courbe ORES, snapshot) | Flux temps réel (compteurs, API ORES) |
| **Livrable** | Rapport PDF + dashboard interactif | Dashboard live + alertes |
| **Modèle** | Consulting productisé | SaaS abonnement |

**Le tunnel de valeur** :

```
Courbe ORES (gratuit)
  → Wattscope Diagnostic (1500-2000€, D3.js, one-shot)
    → Mission approfondie (5-20k€, consulting)
      → Wattscope Monitoring (abonnement, Grafana, temps réel)
```

Le diagnostic est le produit d'entrée (avantage concurrentiel : ELMAS, D3.js custom, PDF). Le monitoring est le produit de rétention (Grafana connecté aux compteurs, alertes basées sur les KPIs du diagnostic).

**Priorité de développement** : Diagnostic d'abord (Phases 1-6 ci-dessous). Monitoring en Phase 7 (après validation du diagnostic par un 1er client).

## Méthode de travail

- Chaque étape : objectif + concepts D3.js à apprendre + pointeurs
- Tu codes, tu me demandes quand tu bloques
- Je t'indique la zone du problème, je ne corrige pas à ta place
- Tu valides chaque étape avant de passer à la suivante
- On documente les concepts appris dans SecondBrain (notes Dev Learning)

---

## Phase 1 — Courbe de charge en D3.js ✅

| Étape | Description | Concepts D3 | Statut |
|---|---|---|---|
| 1 | Setup projet : index.html, main.js, D3+Tailwind CDN, serveur local | Structure projet, `d3.csv()` | ✅ |
| 2 | Premier chart : line chart, scales, axes | `scaleTime`, `scaleLinear`, `d3.line()`, `axisBottom/Left` | ✅ |
| 3 | Audit SWD + corrections | Declutter, axe Y non-zéro, annotations, titre narratif | ✅ |
| 4 | KPIs : base load (P5 nuits), pic, saisonnalité | `d3.rollups()`, `d3.quantile()`, `d3.mean()` | ✅ |
| 5 | Panneau analyse IA (Ollama, streaming, toggle) | `fetch()`, ReadableStream, `TextDecoder` | ✅ |

**Livrable** : page web qui charge un CSV, affiche une courbe de charge annotée + KPIs + analyse IA optionnelle.

---

## Phase 2 — Visualisations avancées

| Étape | Description | Concepts D3 | Statut |
|---|---|---|---|
| 6 | Interactions : hover tooltip (date + kW) + zoom par brush sur la timeline | `d3.bisector()`, `d3.brushX()`, `d3.pointer()`, pattern update | ✅ |
| 7 | Heatmap calendrier jour×heure (type GitHub contribution graph) | `d3.scaleSequential`, `d3.interpolate`, grid layout | À venir |
| 8 | Profil journalier moyen (ligne avec bande HP/HC surlignée) | Aggregation par heure, `d3.line()`, zones colorées | À venir |
| 9 | Décomposition jour/nuit/week-end (stacked bar) | `d3.stack()`, `d3.scaleBand()` | À venir |
| 10 | Layout dashboard : grille responsive qui arrange les 4 charts | CSS Grid, responsive, composition de charts D3 | À venir |

**Livrable** : dashboard complet avec 4 visualisations D3.js interactives, layout responsive. C'est la démo visuelle pour prospecter.

---

## Phase 3 — Backend FastAPI

| Étape | Description | Concepts | Statut |
|---|---|---|---|
| 11 | FastAPI scaffold : `uv init`, `main.py`, endpoint `GET /health` | Structure projet Python, uv, FastAPI de base | À venir |
| 12 | Endpoint `POST /analyze` : upload CSV → calcule KPIs → renvoie JSON | Pandas/Polars, upload fichier, Pydantic, endpoints | À venir |
| 13 | Connect frontend : remplace le calcul JS par un appel API | `fetch()`, async/await, gestion erreurs | À venir |
| 14 | Endpoint intake : formulaire métadonnées (NACE, surface, contrat, tarif) | Pydantic models, validation, forms | À venir |

**Livrable** : le dashboard fait ses calculs côté serveur en Python. Le frontend envoie un CSV + des métadonnées, reçoit les KPIs, affiche les charts.

---

## Phase 4 — Benchmarking ELMAS

| Étape | Description | Concepts | Statut |
|---|---|---|---|
| 15 | Charger les données ELMAS (18 cluster centroids + NACE mapping) | Polars, CSV parsing, cache des données | À venir |
| 16 | Shape matching : standardiser la courbe client, calculer similarité cosinus vs 18 clusters | z-score, cosine similarity, vectorisation | À venir |
| 17 | Intensity ranking : rang percentile kWh/m² vs peer-group NACE | Percentile, distribution, comparaison | À venir |
| 18 | Viz benchmarking : barres avec percentiles P25/P50/P75 + cluster assigné | `d3.scaleBand()`, annotations, comparaison visuelle | À venir |

**Livrable** : le dashboard positionne le client vs ELMAS. C'est le différenciateur concurrentiel.

---

## Phase 5 — Leviers d'économie

| Étape | Description | Concepts | Statut |
|---|---|---|---|
| 19 | Logique de déduction : 3 leviers (right-sizing, load shifting, peak shaving) depuis les KPIs | Règles métier, seuils, estimation €/an | À venir |
| 20 | Viz leviers : cartes avec condition, action, économie estimée, CAPEX, payback | Composants UI, layout, storytelling data | À venir |

**Livrable** : le dashboard montre les leviers d'économie chiffrés. C'est la valeur actionnable.

---

## Phase 6 — PDF + production

| Étape | Description | Concepts | Statut |
|---|---|---|---|
| 21 | Génération PDF (WeasyPrint) : template HTML → PDF avec la synthèse | WeasyPrint, template HTML/CSS, print layout | À venir |
| 22 | Polish UI : design system, couleurs Anthemion, responsive, accessibilité | Design, polish, a11y | À venir |
| 23 | Migration vers Next.js (si besoin) : auth, routing, déploiement | Next.js App Router, BetterAuth, migration D3 | À venir |
| 24 | Déploiement : Coolify + Cloudflare Tunnel → `wattscope.anthemion.dev` | Docker, déploiement, DNS | À venir |

**Livrable** : Wattscope en production, avec PDF, design polished, accessible en ligne.

---

## Phase 7 — Wattscope Monitoring (après 1er client)

> Produit de rétention : dashboard temps réel + alertes.
> Déclencheur : 1er client satisfait du diagnostic qui demande du monitoring continu.
> Stack : Grafana + datasource (InfluxDB ou PostgreSQL timeseries) + alertes basées sur les KPIs du diagnostic.

| Étape | Description | Stack | Statut |
|---|---|---|---|
| 25 | Setup Grafana sur homelab (Coolify, container) | Grafana, Docker | À venir |
| 26 | Datasource : ingestion courbe de charge (API ORES ou export CSV récurrent) | InfluxDB ou PostgreSQL, scripts Python | À venir |
| 27 | Dashboards Grafana : courbe de charge live, KPIs temps réel, heatmaps | Grafana panels | À venir |
| 28 | Alertes intelligentes : seuils basés sur les KPIs du diagnostic (base load, peak, LF) | Grafana alerting | À venir |
| 29 | Modèle abonnement : pricing, multi-tenant, accès client | Stripe, BetterAuth | À venir |

**Livrable** : Wattscope Monitoring en abonnement, dashboard temps réel pour les clients qui veulent surveiller en continu après le diagnostic.

---

## Ce qu'on ne fait pas

- Pas de Prisme (on repart de zéro)
- Pas de code généré par moi sans que tu comprennes
- Pas de saut d'étape — chaque palier est maîtrisé
- Pas de React/Next.js avant la phase 6
- Pas de DB avant la phase 3
- Pas de Grafana/monitoring avant le 1er client (Phase 7)
