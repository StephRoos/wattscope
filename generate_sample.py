import datetime
import csv
import random
import math

random.seed(42)

# ============================================================================
# MODELE DE COURBE DE CHARGE — ZERO pattern periodique
# ============================================================================
# PROBLEME : le sin saisonnier (periode fixe = 370 jours) cree des lignes
# verticales aux equinoxes/solstices (mars, juin, septembre, decembre).
# Ces 4 mois = points ou le gradient du sin est maximal.
#
# SOLUTION : supprimer le sin. Remplacer par des vagues de froid ALEATOIRES
# (non-periodiques). Pas de periode fixe = pas de lignes a dates fixes.
# La saisonnalite emerge des vagues (plus frequentes/hiver, moins/ete)
# sans jamais former un pattern periodique visible.
# ============================================================================

# --- Vagues de froid/chaleur (random walk, par heure, non-periodique) ---
# 3 composantes de random walk, a differentes echelles :
#   1. TRES lent (~3 mois) : remplace le sin saisonnier sans etre periodique
#   2. LENT (~3 semaines) : vagues de froid classiques
#   3. MOYEN (~2-3 jours) : variations process

# Composante 1 : tendance saisonniere NON-PERIODIQUE
# Random walk tres lent qui monte en hiver et descend en ete
# mais SANS periode fixe (chaque annee est differente)
raw_trend = []
current = 20.0  # commence en hiver (positif = plus de conso)
for i in range(8760):
    ts = datetime.datetime(2023, 1, 1) + datetime.timedelta(hours=i)
    day = ts.timetuple().tm_yday - 1
    # "Force" vers le bas en ete (jour 180) et vers le haut en hiver
    # mais avec du bruit pour casser la periodicite
    target = 20 * math.cos(2 * math.pi * (day - 15) / 365)  # tendance
    target += random.gauss(0, 5)  # bruit = pas periodique
    current = 0.999 * current + 0.001 * target  # suivi TRES lent
    raw_trend.append(current)

# Lissage tres large (300h = ~12 jours)
trend_hourly = []
for i in range(8760):
    half = 150
    window = raw_trend[max(0, i - half):min(8760, i + half + 1)]
    trend_hourly.append(sum(window) / len(window))

# Composante 2 : vagues de froid (random walk lent, ~3 semaines)
raw_weather = []
current = 0.0
for i in range(8760):
    ts = datetime.datetime(2023, 1, 1) + datetime.timedelta(hours=i)
    day = ts.timetuple().tm_yday - 1
    stability = 0.5 + 0.5 * math.cos(2 * math.pi * (day - 15) / 365)
    current = 0.99 * current + 0.01 * random.gauss(0, 4 * stability)
    raw_weather.append(current)

weather_hourly = []
for i in range(8760):
    half = 100
    window = raw_weather[max(0, i - half):min(8760, i + half + 1)]
    weather_hourly.append(sum(window) / len(window))

# Composante 3 : variations process (~2-3 jours)
raw_process = []
current = 0.0
for i in range(8760):
    current = 0.97 * current + 0.03 * random.gauss(0, 12)
    raw_process.append(current)

process_hourly = []
for i in range(8760):
    half = 36
    window = raw_process[max(0, i - half):min(8760, i + half + 1)]
    process_hourly.append(sum(window) / len(window))

# --- Intensite de production (random walk continu, ~3 semaines) ---
raw_prod = []
current = 1.0
for i in range(8760):
    current = 0.998 * current + 0.002 * random.gauss(1.0, 0.08)
    raw_prod.append(max(0.7, min(1.3, current)))

prod_intensity = []
for i in range(8760):
    half = 200
    window = raw_prod[max(0, i - half):min(8760, i + half + 1)]
    prod_intensity.append(sum(window) / len(window))

# ============================================================================
# GENERATION
# ============================================================================
start = datetime.datetime(2023, 1, 1)
with open("data/sample.csv", "w", newline="") as f:
    writer = csv.writer(f)
    writer.writerow(["timestamp", "power_kW"])
    for i in range(8760):
        ts = start + datetime.timedelta(hours=i)
        hour = ts.hour + ts.minute / 60.0
        day_of_week = ts.weekday()

        # --- Base load ---
        p = 280 + random.gauss(0, 12)

        # --- Tendance saisonniere NON-PERIODIQUE (random walk) ---
        p += trend_hourly[i]

        # --- Vagues de froid ---
        p += weather_hourly[i]

        # --- Variations process ---
        p += process_hourly[i]

        # --- Bruit horaire (fort, domine tout) ---
        if 7 <= hour < 19:
            p += random.gauss(0, 25)
        else:
            p += random.gauss(0, 12)

        # --- Niveau de production par jour (CONTINU) ---
        week_pos = day_of_week + hour / 24.0
        if week_pos < 5.0:
            day_level = 0.9 + 0.1 * math.sin(math.pi * (week_pos - 0.5) / 4.5)
        else:
            we_pos = week_pos - 5.0
            day_level = 0.3 + 0.2 * math.cos(math.pi * we_pos / 2.0)

        day_level *= prod_intensity[i]

        # --- Profil horaire avec rampes DOUCES ---
        production = 0
        if 6 <= hour < 20:
            if 6 <= hour < 9:
                ramp = (hour - 6) / 3.0
                ramp = ramp * ramp * (3 - 2 * ramp)
                production = 200 * day_level * ramp
            elif 9 <= hour < 16:
                production = 200 * day_level + random.gauss(0, 30)
            elif 16 <= hour < 20:
                ramp = 1 - (hour - 16) / 4.0
                ramp = ramp * ramp * (3 - 2 * ramp)
                production = 200 * day_level * ramp + random.gauss(0, 15)

        p += production

        # --- Pics occasionnels ---
        spike_prob = 0.012 if 8 <= ts.hour < 10 else 0.005 if 13 <= ts.hour < 14 else 0.003
        if random.random() < spike_prob:
            p += random.uniform(25, 95)

        # --- Baisses occasionnelles ---
        if random.random() < 0.004:
            p -= random.uniform(15, 55)

        p = max(200, p)
        writer.writerow([ts.strftime("%Y-%m-%d %H:%M:%S"), round(p, 1)])
