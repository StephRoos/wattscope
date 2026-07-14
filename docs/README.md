# Wattscope

> Diagnostic productisé de courbe de charge électrique pour PME industrielles wallonnes.
> Ligne A du plan maître — voir `~/SecondBrain/01-Projects/wattscope/_moc.md`

## Démarrage

```bash
cd ~/Projects/wattscope

# Lancer un serveur local (requis pour d3.csv — le navigateur bloque file://)
uv run python -m http.server 8000

# Ouvrir http://localhost:8000 dans le navigateur
```

Prérequis :
- Python 3.14+ (via uv)
- Ollama avec qwen2.5:7b (pour l'analyse IA, optionnel) : `ollama serve`

## Structure

```
wattscope/
├── index.html              # Page principale (D3 v7 + Tailwind CDN)
├── js/
│   └── main.js             # Chart D3 + KPIs + appel Ollama
├── data/
│   └── sample.csv          # Courbe de charge synthétique (8760 points, 2023)
├── generate_sample.py       # Génère data/sample.csv
├── docs/                    # Documentation projet (ce dossier)
│   ├── README.md            # Ce fichier
│   ├── architecture.md      # Stack, structure, décisions techniques
│   ├── plan-dev.md          # Plan de développement (6 phases, 24 étapes)
│   └── decisions.md         # Journal des décisions (ADR)
├── pyproject.toml           # Config uv
└── README.md                # Ce fichier
```

## Documentation

- [Architecture](architecture.md) — stack, structure, décisions techniques
- [Plan de développement](plan-dev.md) — 6 phases, 24 étapes, statut
- [Décisions](decisions.md) — journal des arbitrages techniques et produit

## Documentation SecondBrain

Le miroir stratégique vit dans SecondBrain :
- `01-Projects/wattscope/_moc.md` — vue d'ensemble, statut, liens
- `02-Areas/consultant-data-energie/wattscope/` — cadrage, specs, étude de marché, positionnement
- `02-Areas/developpeur-tech/apprentissage/cours/d3js/` — notes d'apprentissage D3.js
- `02-Areas/developpeur-tech/apprentissage/cours/dataviz/` — principes Storytelling with Data

## État actuel

Phase 1 (courbe de charge D3.js) — étapes 1-5 terminées :
- Line chart avec agrégation quotidienne (365 points)
- Annotations SWD (base load pointillé, pic orange, titre narratif)
- Panneau analyse IA (Ollama, streaming, toggle bouton)
