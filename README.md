# Wattscope

> Diagnostic productisé de courbe de charge électrique pour PME industrielles wallonnes.

## Démarrage

```bash
cd ~/Projects/wattscope

# Lancer un serveur local (requis pour d3.csv)
uv run python -m http.server 8000

# Ouvrir http://localhost:8000
```

Prérequis :
- Python 3.14+ (via uv)
- Ollama + qwen2.5:7b (pour l'analyse IA, optionnel) : `ollama serve`

## Documentation

- [docs/README.md](docs/README.md) — index documentation
- [docs/architecture.md](docs/architecture.md) — stack, structure, décisions
- [docs/plan-dev.md](docs/plan-dev.md) — plan de développement (6 phases, 24 étapes)
- [docs/decisions.md](docs/decisions.md) — journal des décisions (ADR)

## SecondBrain

Le miroir stratégique vit dans `~/SecondBrain/` :
- `01-Projects/wattscope/_moc.md` — vue d'ensemble
- `02-Areas/consultant-data-energie/wattscope/` — cadrage, specs, étude de marché, positionnement
- `02-Areas/developpeur-tech/apprentissage/cours/d3js/` — notes d'apprentissage D3.js
- `02-Areas/developpeur-tech/apprentissage/cours/dataviz/` — principes Storytelling with Data

## État

Phase 1 (courbe de charge D3.js) — étapes 1-5 terminées.
