#!/usr/bin/env python3
"""
Generates db/seed/demo_library.sql (demo data reproducing the approved mockups).

Usage:  python3 db/seed/generate_seed.py > db/seed/demo_library.sql
        python3 db/seed/generate_seed.py --check   (prints a report)

The seed is deterministic (fixed UUIDs, fixed PRNG seed). All domain writes go
through the real public RPCs (start_reading, record_progress, finish_reading,
mark_dnf, add_completed_reading, save_review, queue_add, assign_bingo_book) while
impersonating the demo user through the app.user_id setting, so the
denormalised projections on user_books are produced by the database itself.

Requires Python >= 3.8, no third-party packages.
"""
import datetime as dt
import random
import sys
import uuid

DEMO_UID = "de000000-0000-4000-8000-000000000001"
DEMO_EMAIL = "demo@segnalibro.local"
DEMO_PASSWORD = "segnalibro-demo"
TODAY_ANCHOR = dt.date(2026, 9, 29)  # last day of the current streak
YEAR = 2026

G = {"classics": 1, "myth": 2, "dist": 3, "thriller": 4, "fantasy": 5, "romance": 6, "contemp": 7}

DIMS = {
    1: ["classics.style", "classics.characters", "classics.themes", "classics.pacing", "classics.impact"],
    2: ["mythology.reinterpretation", "mythology.characters", "mythology.atmosphere", "mythology.pacing", "mythology.world"],
    3: ["scifi.concept", "scifi.worldbuilding", "scifi.coherence", "scifi.characters", "scifi.pacing"],
    4: ["thriller.tension", "thriller.mystery", "thriller.twists", "thriller.pacing", "thriller.ending"],
    5: ["fantasy.worldbuilding", "fantasy.magic", "fantasy.characters", "fantasy.pacing", "fantasy.atmosphere"],
    6: ["romance.chemistry", "romance.characters", "romance.relationship", "romance.emotion", "romance.pacing"],
    7: ["contemporary.characters", "contemporary.style", "contemporary.setting", "contemporary.themes", "contemporary.emotional"],
}

# --------------------------------------------------------------------------
# Library. Order inside each genre == left-to-right order on the shelf
# (Home orders by created_at DESC, so earlier in this list = newer row).
# key: (title, author, pages, format)   format: p = physical, d = digital
# --------------------------------------------------------------------------
SHELVES = {
    "classics": [
        ("orgoglio", "Orgoglio e pregiudizio", "Jane Austen", 432, "p"),
        ("dorian", "Il ritratto di Dorian Gray", "Oscar Wilde", 256, "p"),
        ("promessi", "I promessi sposi", "Alessandro Manzoni", 720, "p"),
        ("bovary", "Madame Bovary", "Gustave Flaubert", 384, "p"),
        ("delitto", "Il delitto e il castigo", "Fëdor Dostoevskij", 672, "p"),
        ("pascal", "Il fu Mattia Pascal", "Luigi Pirandello", 256, "p"),
        ("barone", "Il barone rampante", "Italo Calvino", 272, "p"),
        ("cime", "Cime tempestose", "Emily Brontë", 400, "p"),
        ("gattopardo", "Il Gattopardo", "Giuseppe Tomasi di Lampedusa", 320, "p"),
        ("karenina", "Anna Karenina", "Lev Tolstoj", 864, "p"),
        ("jane_eyre", "Jane Eyre", "Charlotte Brontë", 560, "p"),
        ("ulisse", "Ulisse", "James Joyce", 1008, "p"),
        ("moby", "Moby Dick", "Herman Melville", 704, "p"),
        # read in 2024/2025 (feed the past Bingo cards)
        ("montecristo", "Il conte di Montecristo", "Alexandre Dumas", 1312, "p"),
        ("piccole_donne", "Piccole donne", "Louisa May Alcott", 480, "p"),
        ("piccolo_principe", "Il Piccolo Principe", "Antoine de Saint-Exupéry", 96, "p"),
        ("divina", "La Divina Commedia", "Dante Alighieri", 500, "p"),
        ("processo", "Il processo", "Franz Kafka", 240, "p"),
    ],
    "myth": [
        ("circe", "Circe", "Madeline Miller", 432, "p"),
        ("achille", "La canzone di Achille", "Madeline Miller", 412, "d"),
        ("silenzio_ragazze", "Il silenzio delle ragazze", "Pat Barker", 368, "p"),
        ("penelope", "Il canto di Penelope", "Margaret Atwood", 160, "p"),
        ("norse", "Norse Mythology", "Neil Gaiman", 304, "d"),
        ("lavinia", "Lavinia", "Ursula K. Le Guin", 352, "p"),
        ("medea", "Medea. Voci", "Christa Wolf", 288, "p"),
        ("iliade", "Iliade", "Omero", 640, "p"),
        ("odissea", "Odissea", "Omero", 496, "p"),
    ],
    "dist": [
        ("dune", "Dune", "Frank Herbert", 712, "p"),
        ("tre_corpi", "Il problema dei tre corpi", "Liu Cixin", 400, "d"),
        ("1984", "1984", "George Orwell", 328, "p"),
        ("ancella", "Il racconto dell'ancella", "Margaret Atwood", 352, "p"),
        ("fahrenheit", "Fahrenheit 451", "Ray Bradbury", 208, "p"),
        ("neuromante", "Neuromante", "William Gibson", 288, "p"),
        ("mondo_nuovo", "Il mondo nuovo", "Aldous Huxley", 288, "p"),
        ("fondazione", "Fondazione", "Isaac Asimov", 320, "p"),
        ("solaris", "Solaris", "Stanisław Lem", 224, "p"),
        ("hunger", "Hunger Games", "Suzanne Collins", 384, "p"),
        ("fondazione_impero", "Fondazione e impero", "Isaac Asimov", 288, "p"),
        ("androidi", "Ma gli androidi sognano pecore elettriche?", "Philip K. Dick", 240, "p"),
    ],
    "thriller": [
        ("orient", "Assassinio sull'Orient Express", "Agatha Christie", 256, "d"),
        ("silenzio_innocenti", "Il silenzio degli innocenti", "Thomas Harris", 368, "p"),
        ("uomini", "Uomini che odiano le donne", "Stieg Larsson", 672, "p"),
        ("civetta", "Il giorno della civetta", "Leonardo Sciascia", 160, "p"),
        ("dieci_piccoli", "Dieci piccoli indiani", "Agatha Christie", 264, "p"),
        ("ragazza_treno", "La ragazza del treno", "Paula Hawkins", 378, "p"),
        ("gone_girl", "Gone Girl", "Gillian Flynn", 464, "p"),
        ("studio_rosso", "Uno studio in rosso", "Arthur Conan Doyle", 192, "p"),
        ("da_vinci", "Il codice da Vinci", "Dan Brown", 552, "p"),
        ("shutter", "Shutter Island", "Dennis Lehane", 384, "p"),
        ("baskerville", "Il mastino dei Baskerville", "Arthur Conan Doyle", 256, "p"),
    ],
    "fantasy": [
        ("nome_vento", "Il nome del vento", "Patrick Rothfuss", 662, "p"),
        ("paura_saggio", "La paura del saggio", "Patrick Rothfuss", 1008, "d"),
        ("rebecca", "Rebecca", "Daphne du Maurier", 408, "p"),
        ("cent_anni", "Cent'anni di solitudine", "Gabriel García Márquez", 448, "p"),
        ("hobbit", "Lo Hobbit", "J.R.R. Tolkien", 310, "p"),
        ("strange", "Jonathan Strange & Mr Norrell", "Susanna Clarke", 1024, "p"),
        ("lotr", "Il Signore degli Anelli", "J.R.R. Tolkien", 1216, "p"),
        ("frankenstein", "Frankenstein", "Mary Shelley", 288, "p"),
        ("dracula", "Dracula", "Bram Stoker", 512, "p"),
        ("maestro", "Il maestro e Margherita", "Michail Bulgakov", 480, "p"),
        ("silmarillion", "Il Silmarillion", "J.R.R. Tolkien", 496, "p"),
        ("hp1", "Harry Potter e la pietra filosofale", "J.K. Rowling", 320, "p"),
        ("american_gods", "American Gods", "Neil Gaiman", 560, "p"),
        ("hp2", "Harry Potter e la camera dei segreti", "J.K. Rowling", 352, "p"),
        ("storia_infinita", "La storia infinita", "Michael Ende", 480, "p"),
    ],
    "romance": [
        ("royal_blue", "Red, White & Royal Blue", "Casey McQuiston", 448, "d"),
        ("duca", "Il duca e io", "Julia Quinn", 384, "p"),
        ("colpa_stelle", "Colpa delle stelle", "John Green", 288, "p"),
        ("dopo_di_te", "Dopo di te", "Jojo Moyes", 400, "p"),
        ("bridget", "Il diario di Bridget Jones", "Helen Fielding", 352, "p"),
        ("un_giorno", "Un giorno", "David Nicholls", 464, "p"),
        ("it_ends", "It Ends with Us", "Colleen Hoover", 384, "d"),
        ("ps_love", "P.S. I Love You", "Cecelia Ahern", 416, "p"),
    ],
    "contemp": [
        ("otto_montagne", "Le otto montagne", "Paolo Cognetti", 264, "p"),
        ("nome_rosa", "Il nome della rosa", "Umberto Eco", 503, "p"),
        ("coccodrilli", "Coccodrilli", "Autore demo", 320, "p"),
        ("holden", "Il giovane Holden", "J.D. Salinger", 240, "p"),
        ("amica_geniale", "L'amica geniale", "Elena Ferrante", 331, "p"),
        ("solitudine", "La solitudine dei numeri primi", "Paolo Giordano", 320, "p"),
        ("norwegian", "Norwegian Wood", "Haruki Murakami", 384, "p"),
        ("normal_people", "Normal People", "Sally Rooney", 266, "d"),
        ("cardellino", "Il cardellino", "Donna Tartt", 864, "p"),
        ("pilastri", "I pilastri della terra", "Ken Follett", 976, "p"),
        ("cacciatore", "Il cacciatore di aquiloni", "Khaled Hosseini", 372, "p"),
        ("orecchino", "La ragazza con l'orecchino di perla", "Tracy Chevalier", 240, "p"),
        ("viaggiatore", "Se una notte d'inverno un viaggiatore", "Italo Calvino", 272, "p"),
        ("profumo", "Il profumo", "Patrick Süskind", 272, "p"),
        ("riccio", "L'eleganza del riccio", "Muriel Barbery", 320, "p"),
    ],
}

SERIES = {
    "nome_vento": ("Le Cronache dell'Assassino del Re", 1, 3),
    "paura_saggio": ("Le Cronache dell'Assassino del Re", 2, 3),
    "fondazione": ("Il ciclo delle Fondazioni", 1, 7),
    "fondazione_impero": ("Il ciclo delle Fondazioni", 2, 7),
    "hp1": ("Harry Potter", 1, 7),
    "hp2": ("Harry Potter", 2, 7),
}

BOOKS = {}
ORDER = []
_n = 0
for gk, rows in SHELVES.items():
    for i, (key, title, author, pages, fmt) in enumerate(rows):
        BOOKS[key] = dict(key=key, title=title, author=author, pages=pages,
                          fmt="digital" if fmt == "d" else "physical",
                          genre=G[gk], genre_key=gk, shelf_idx=i, n=_n)
        ORDER.append(key)
        _n += 1

# Page-count tweaks (edition differences) used to hit the 18,420 annual total.
PAGE_TWEAKS = {}

def bid(key):
    return "d0000000-0000-4000-8000-%012x" % (BOOKS[key]["n"] + 1)

def uid5(*parts):
    return str(uuid.uuid5(uuid.UUID("5e91a1b0-0000-4000-8000-000000000000"), "/".join(str(p) for p in parts)))

# --------------------------------------------------------------------------
# 2026 reading schedule (chain of completed readings, month by month)
# --------------------------------------------------------------------------
MONTH_PLAN = {
    1: ["nome_vento", "civetta", "holden", "dorian"],
    2: ["achille", "silenzio_innocenti", "1984", "pascal", "dopo_di_te"],
    3: ["penelope", "solaris", "dieci_piccoli", "bridget", "barone", "colpa_stelle",
        "frankenstein", "mondo_nuovo", "ancella"],
    4: ["norse", "bovary", "neuromante", "ragazza_treno", "duca"],
    5: ["odissea", "cent_anni", "fondazione", "gone_girl", "un_giorno"],
    6: ["lotr", "normal_people", "it_ends", "maestro"],
    7: ["lavinia", "dracula", "nome_rosa", "cardellino"],
    8: ["silenzio_ragazze", "amica_geniale", "cime"],
    9: ["orgoglio", "pilastri", "achille#2", "uomini"],
}

# Days WITHOUT reading activity (gaps between streaks).
GAP_DAYS = [
    dt.date(2026, 1, 26), dt.date(2026, 2, 14), dt.date(2026, 3, 28), dt.date(2026, 4, 23),
    dt.date(2026, 5, 18), dt.date(2026, 6, 21), dt.date(2026, 6, 22), dt.date(2026, 7, 29),
    dt.date(2026, 8, 26), dt.date(2026, 8, 27), dt.date(2026, 9, 6),
]
FIRST_DAY = dt.date(2026, 1, 3)
LAST_DAY = TODAY_ANCHOR

def active_days():
    d, out = FIRST_DAY, []
    while d <= LAST_DAY:
        if d not in GAP_DAYS:
            out.append(d)
        d += dt.timedelta(days=1)
    return out

A = active_days()
A_SET = set(A)

def month_bounds(m):
    start = dt.date(2026, m, 1)
    if m == 12:
        end = dt.date(2026, 12, 31)
    else:
        end = dt.date(2026, m + 1, 1) - dt.timedelta(days=1)
    if m == 1:
        start = FIRST_DAY
    if end > LAST_DAY:
        end = LAST_DAY
    return start, end

def pages_of(key):
    k = key.split("#")[0]
    return PAGE_TWEAKS.get(k, BOOKS[k]["pages"])

def build_windows():
    wins = []  # (key, start_date, end_date)
    for m, keys in MONTH_PLAN.items():
        ms, me = month_bounds(m)
        if m == 1:
            # the reread of Il nome del vento is fixed by the mockup: 3 Jan -> 18 Jan
            wins.append((keys[0], dt.date(2026, 1, 3), dt.date(2026, 1, 18)))
            rest = keys[1:]
            start = dt.date(2026, 1, 18)
        else:
            rest = keys
            start = ms
        total = sum(pages_of(k) for k in rest)
        span = (me - start).days
        cum, prev = 0, start
        for i, k in enumerate(rest):
            cum += pages_of(k)
            end = me if i == len(rest) - 1 else start + dt.timedelta(days=round(cum / total * span))
            wins.append((k, prev, end))
            prev = end
    return wins

def at(day, hour, minute):
    return "%s %02d:%02d" % (day.isoformat(), hour, minute)

def allocate(rng, days, pages):
    """cumulative page values, strictly increasing, last == pages"""
    n = len(days)
    if n == 1:
        return [pages]
    weights = [rng.uniform(0.55, 1.45) for _ in range(n)]
    tot = sum(weights)
    cum, acc, prev = [], 0.0, 0
    for i, w in enumerate(weights):
        acc += w
        v = pages if i == n - 1 else int(round(acc / tot * pages))
        v = max(v, prev + 1)
        v = min(v, pages - (n - 1 - i))
        cum.append(v)
        prev = v
    return cum

class Reading:
    def __init__(self, key, kind, start_day, end_day, final_page=None):
        self.key, self.kind = key, kind  # kind: done | open | dnf
        self.start_day, self.end_day = start_day, end_day
        self.final_page = final_page
        self.events = []  # (kind, page, day, time)

def build_readings(rng):
    readings = []
    for key, s, e in build_windows():
        base = key.split("#")[0]
        days = [d for d in A if s <= d <= e]
        if not days:
            days = [max(d for d in A if d <= e)]
        r = Reading(base, "done", s, days[-1], pages_of(key))
        cum = allocate(rng, days, pages_of(key))
        for i, (d, p) in enumerate(zip(days, cum)):
            last = i == len(days) - 1
            hh = rng.choice([19, 20, 21, 22]) if not last else rng.choice([21, 22])
            r.events.append(("finish" if last else "progress", p, d, (hh, rng.randint(0, 59))))
        readings.append(r)

    # DNF readings (parallel to the chain)
    for key, s, e, page in [
        ("silmarillion", dt.date(2026, 2, 9), dt.date(2026, 2, 12), 58),
        ("moby", dt.date(2026, 6, 5), dt.date(2026, 6, 11), 204),
        ("ulisse", dt.date(2026, 8, 9), dt.date(2026, 8, 14), 112),
    ]:
        days = [d for d in A if s <= d <= e]
        r = Reading(key, "dnf", s, days[-1], page)
        cum = allocate(rng, days, page)
        for i, (d, p) in enumerate(zip(days, cum)):
            last = i == len(days) - 1
            r.events.append(("dnf" if last else "progress", p, d, (rng.choice([18, 19, 20]), rng.randint(0, 59))))
        readings.append(r)

    # currently reading
    for key, s, e, page, last_time in [
        ("otto_montagne", dt.date(2026, 9, 21), dt.date(2026, 9, 29), 164, (21, 50)),
        ("dune", dt.date(2026, 9, 10), dt.date(2026, 9, 29), 214, (22, 15)),
    ]:
        days = [d for d in A if s <= d <= e]
        r = Reading(key, "open", s, None, page)
        cum = allocate(rng, days, page)
        for i, (d, p) in enumerate(zip(days, cum)):
            last = i == len(days) - 1
            r.events.append(("progress", p, d, last_time if last else (rng.choice([6, 7, 12, 13, 23]), rng.randint(0, 59))))
        readings.append(r)
    return readings

# Older completed readings (no per-day events; covered by the historical fallback)
OLD_READINGS = [
    # key, started, finished
    ("nome_vento", "2024-03-12", "2024-03-29"),
    ("montecristo", "2024-01-06", "2024-02-20"),
    ("piccole_donne", "2024-04-02", "2024-04-14"),
    ("hp1", "2024-05-01", "2024-05-09"),
    ("piccolo_principe", "2024-05-21", "2024-05-22"),
    ("american_gods", "2024-06-10", "2024-07-04"),
    ("cacciatore", "2024-07-15", "2024-07-28"),
    ("orecchino", "2024-08-09", "2024-08-16"),
    ("viaggiatore", "2024-09-03", "2024-09-20"),
    ("hunger", "2024-10-05", "2024-10-16"),
    ("da_vinci", "2024-11-02", "2024-11-19"),
    ("promessi", "2025-01-08", "2025-02-12"),
    ("delitto", "2025-02-20", "2025-03-28"),
    ("dune", "2025-05-03", "2025-05-28"),
    ("tre_corpi", "2025-08-01", "2025-08-14"),
    ("hobbit", "2025-10-05", "2025-10-14"),
    ("divina", "2025-03-30", "2025-05-01"),
    ("processo", "2025-06-01", "2025-06-09"),
    ("fondazione_impero", "2025-06-15", "2025-06-27"),
    ("androidi", "2025-07-02", "2025-07-09"),
    ("shutter", "2025-07-20", "2025-07-31"),
    ("baskerville", "2025-08-20", "2025-08-27"),
    ("hp2", "2025-09-01", "2025-09-08"),
    ("storia_infinita", "2025-09-15", "2025-10-01"),
    ("ps_love", "2025-10-20", "2025-10-29"),
    ("profumo", "2025-11-03", "2025-11-10"),
    ("riccio", "2025-11-15", "2025-11-24"),
]

RATINGS = {
    "achille": 5, "odissea": 5, "silenzio_ragazze": 4, "penelope": 4, "norse": 4, "lavinia": 3,
    "nome_vento": 4, "dune": 5, "lotr": 5, "orgoglio": 5, "nome_rosa": 4, "ragazza_treno": 4,
    "tre_corpi": 4, "1984": 5,
}
ADJ_POOL = ["Epico", "Malinconico", "Immersivo", "Intenso", "Poetico", "Teso", "Ironico", "Commovente",
            "Visionario", "Delicato", "Crudo", "Avvincente", "Elegante", "Struggente", "Luminoso", "Inquieto",
            "Corale", "Travolgente", "Riflessivo", "Sorprendente", "Cupo", "Tenero", "Ipnotico", "Potente"]

TAGS_2026 = {
    "friendship": ["nome_vento", "lotr", "achille", "amica_geniale", "holden", "colpa_stelle", "cardellino",
                   "normal_people", "pilastri", "dopo_di_te", "bridget", "un_giorno"],
    "magic": ["nome_vento", "lotr", "cent_anni", "maestro", "frankenstein", "dracula", "odissea", "norse", "lavinia"],
    "travel": ["odissea", "lotr", "norse", "holden", "solaris", "ragazza_treno", "cent_anni"],
    "coming-of-age": ["nome_vento", "holden", "amica_geniale", "orgoglio", "normal_people", "barone"],
    "love": ["orgoglio", "cime", "duca", "bovary", "it_ends"],
    "loss": ["penelope", "dopo_di_te", "colpa_stelle", "cardellino"],
    "mystery": ["silenzio_innocenti", "civetta", "dieci_piccoli", "ragazza_treno", "gone_girl"],
    "war": ["odissea", "1984", "fondazione"],
    "society": ["1984", "ancella", "mondo_nuovo", "fondazione"],
    "identity": ["frankenstein", "dorian", "pascal"],
    "music": ["nome_vento"],
}
EXTRA_TAGS = {  # older books / current reads
    "dune": ["power", "survival"], "tre_corpi": ["technology", "survival"], "hobbit": ["adventure", "friendship"],
    "promessi": ["love", "religion"], "delitto": ["trauma", "identity"],
    "otto_montagne": ["friendship", "nature"],
}
ADJ_FIXED = {"nome_vento": ["Epico", "Malinconico", "Immersivo"]}
SCORES_FIXED = {"nome_vento": [5, 5, 4, 3, 5]}

def book_tags(key):
    tags = [t for t, ks in TAGS_2026.items() if key in ks]
    tags += EXTRA_TAGS.get(key, [])
    return tags

def q(s):
    return "'" + s.replace("'", "''") + "'"

def ts(local):
    return "(%s::timestamp at time zone 'Europe/Rome')" % q(local)

# --------------------------------------------------------------------------
# Bingo
# --------------------------------------------------------------------------
CHALLENGES = [
    "Oltre 500 pagine", "Bestseller", "Diventato un film", "Letto in digitale",
    "5 stelle", "Premio letterario", "Poesia", "Narratore inaffidabile",
    "Un classico", "Retelling mitologico", "Thriller o giallo", "Titolo di una parola",
    "Dark Academia", "Colpo di scena", "Letto in viaggio", "Libro da BookTok",
]
BINGO_2026 = {1: "lotr", 3: "dune", 4: "tre_corpi", 6: "nome_rosa", 9: "orgoglio", 11: "ragazza_treno", 14: "nome_vento"}
BINGO_2025 = ["promessi", "delitto", "dune", "tre_corpi", "hobbit", "divina", "processo", "fondazione_impero",
              "androidi", "shutter", "baskerville", "hp2", "storia_infinita", "ps_love", "profumo", "riccio"]
BINGO_2024 = ["nome_vento", "montecristo", "piccole_donne", "hp1", "piccolo_principe", "american_gods",
              "cacciatore", "orecchino", "viaggiatore", "hunger", "da_vinci"]

QUEUE = ["circe", "tre_corpi", "orient"]

def generate():
    rng = random.Random(20260930)
    readings = build_readings(rng)
    out = []
    w = out.append

    w("-- Segnalibro — development seed (GENERATED by db/seed/generate_seed.py, do not edit by hand)")
    w("--")
    w("-- Demo account : %s / %s   (display name: Alessandra)" % (DEMO_EMAIL, DEMO_PASSWORD))
    w("-- Reproduces the approved mockups (Home, Mitologia, Dettaglio, Esplora, Statistiche, Bingo).")
    w("--")
    w("-- Run by scripts/db-seed.mjs, which FIRST deletes and recreates the demo user")
    w("-- (app.users, id %s, password hashed with the same scrypt" % DEMO_UID)
    w("-- code as registerUser) inside the same transaction. Deleting the user cascades to")
    w("-- every row below, so seeding is idempotent.")
    w("-- Domain data is written through the public RPCs, impersonating the demo user.")
    w("")
    w("-- 1. user_books (shelf order == created_at DESC) -----------------------------")
    w("insert into public.user_books (")
    w("  id, user_id, genre_id, title, author_display, page_count, language, format, source,")
    w("  series_name, series_number, series_total, created_at")
    w(") values")
    rows = []
    gcount = {}
    for key in ORDER:
        b = BOOKS[key]
        gk = b["genre_key"]
        i = b["shelf_idx"]
        ser = SERIES.get(key)
        created = "(timestamptz '2024-02-01 09:00:00+01' - interval '%d minutes')" % (i + 1)
        rows.append("  (%s, %s, %d, %s, %s, %d, 'it', %s, 'manual', %s, %s, %s, %s)" % (
            q(bid(key)), q(DEMO_UID), b["genre"], q(b["title"]), q(b["author"]), pages_of(key),
            q(b["fmt"]),
            q(ser[0]) if ser else "null", ser[1] if ser else "null", ser[2] if ser else "null",
            created))
    w(",\n".join(rows) + ";")
    w("")

    w("-- 2. reading history + reviews + queue + bingo (through the public RPCs) -----")
    w("do $seed$")
    w("declare")
    w("  v_uid uuid := %s;" % q(DEMO_UID))
    w("  v_rid uuid;")
    w("  v_cell uuid;")
    w("begin")
    w("  perform set_config('app.user_id', v_uid::text, true);")
    w("")
    w("  -- older completed readings (2024, 2025)")
    for key, s, e in OLD_READINGS:
        w("  perform public.add_completed_reading(%s, %s, %s, %d, 0);" % (
            q(bid(key)), ts(s + " 10:00"), ts(e + " 22:00"), pages_of(key)))
    w("")
    w("  -- 2026 readings with real progress events")
    # chronological by first event for readability
    readings.sort(key=lambda r: (r.start_day, r.key))
    for r in readings:
        w("  -- %s (%s)" % (BOOKS[r.key]["title"], r.kind))
        w("  v_rid := (public.start_reading(%s, %s, 0)->'reading'->>'id')::uuid;" % (
            q(bid(r.key)), ts(at(r.start_day, 8, 0))))
        for idx, (kind, page, day, (hh, mm)) in enumerate(r.events):
            eid = q(uid5("event", r.key, r.start_day, idx))
            args = "%s, v_rid, %d, %s, %s" % (eid, page, ts(at(day, hh, mm)), q(day.isoformat()))
            fn = {"progress": "record_progress", "finish": "finish_reading", "dnf": "mark_dnf"}[kind]
            w("  perform public.%s(%s);" % (fn, args))
    w("")
    w("  -- reviews (rating, 3 adjectives, genre dimensions, thematic tags)")
    reviewed = set(k for k, _, _ in OLD_READINGS)
    for r in readings:
        if r.kind == "done":
            reviewed.add(r.key)
    rrng = random.Random(77)
    for key in ORDER:
        if key not in reviewed:
            continue
        b = BOOKS[key]
        rating = RATINGS.get(key, rrng.choice([3, 4, 4, 4, 5, 5]))
        adj = ADJ_FIXED.get(key) or rrng.sample(ADJ_POOL, 3)
        scores = SCORES_FIXED.get(key) or [min(5, max(1, rating + rrng.choice([-1, 0, 0, 1]))) for _ in range(5)]
        dims = DIMS[b["genre"]]
        sc = ",".join('{"dimension_key":"%s","score":%d}' % (d, s) for d, s in zip(dims, scores))
        tags = book_tags(key)
        tag_sql = "coalesce((select array_agg(t.id order by t.sort_order) from public.tags t where t.slug = any(%s)), '{}'::smallint[])" % (
            "array[" + ",".join(q(t) for t in tags) + "]::text[]") if tags else "'{}'::smallint[]"
        w("  perform public.save_review(%s, %d::smallint, array[%s]::text[], %s::jsonb, %s);" % (
            q(bid(key)), rating, ",".join(q(a) for a in adj), q("[" + sc + "]"), tag_sql))
    # tags on the current reading Le otto montagne cannot exist (review needs a completed reading);
    w("")
    w("  -- queue (\"I prossimi 3\")")
    for key in QUEUE:
        w("  perform public.queue_add(%s, false);" % q(bid(key)))
    w("")
    w("  -- quotes")
    w("  insert into public.quotes (id, user_id, user_book_id, body, page, created_at, updated_at) values")
    w("    (%s, v_uid, %s, %s, 131, timestamptz '2026-09-24 20:10:00+02', timestamptz '2026-09-24 20:10:00+02'),"
      % (q(uid5("quote", "otto")), q(bid("otto_montagne")), q("La montagna non chiede niente, ti lascia solo il passo.")))
    w("    (%s, v_uid, %s, %s, 48, timestamptz '2026-09-28 22:30:00+02', timestamptz '2026-09-28 22:30:00+02');"
      % (q(uid5("quote", "nome")), q(bid("nome_vento")), q("Certe storie si leggono due volte: la prima per sapere, la seconda per restare.")))
    w("")
    w("  -- Bookish Bingo boards")
    for year, title in [(2026, "La card del 2026"), (2025, "La card del 2025"), (2024, "La card del 2024")]:
        bdid = uid5("board", year)
        w("  insert into public.bingo_boards (id, user_id, year, title) values (%s, v_uid, %d, %s);" % (q(bdid), year, q(title)))
        for pos, ch in enumerate(CHALLENGES, start=1):
            w("  insert into public.bingo_cells (id, user_id, board_id, position, challenge) values (%s, v_uid, %s, %d, %s);" % (
                q(uid5("cell", year, pos)), q(bdid), pos, q(ch)))
    for pos, key in BINGO_2026.items():
        w("  perform public.assign_bingo_book(%s, %s);" % (q(uid5("cell", 2026, pos)), q(bid(key))))
    for year, keys in [(2025, BINGO_2025), (2024, BINGO_2024)]:
        for pos, key in enumerate(keys, start=1):
            w("  perform public.assign_bingo_book(%s, %s);" % (q(uid5("cell", year, pos)), q(bid(key))))
        # completed_at: spread over the year instead of 'now()'
        w("  update public.bingo_cells set completed_at = (timestamptz '%d-12-20 12:00:00+01' - (position * interval '17 days'))"
          " where user_id = v_uid and board_id = %s and user_book_id is not null;" % (year, q(uid5("board", year))))
    w("")
    w("  perform set_config('app.user_id', '', true);")
    w("end")
    w("$seed$;")
    w("")
    return "\n".join(out) + "\n", readings

def report(readings):
    # replicate the statistics computed by the database to sanity-check the plan
    done = [r for r in readings if r.kind == "done"]
    pages = sum(r.events[-1][1] for r in readings)
    print("readings completed in 2026:", len(done), file=sys.stderr)
    print("total pages (events, 2026):", pages, "(target 18420)", file=sys.stderr)
    from collections import Counter
    months = Counter(r.events[-1][2].month for r in done)
    print("per month:", dict(sorted(months.items())), file=sys.stderr)
    genres = Counter(BOOKS[r.key]["genre_key"] for r in done)
    print("per genre:", dict(genres), file=sys.stderr)
    authors = Counter(BOOKS[r.key]["author"] for r in done)
    print("top authors:", authors.most_common(4), file=sys.stderr)
    days = sorted(set(e[2] for r in readings for e in r.events))
    runs, run = [], 1
    for a, b in zip(days, days[1:]):
        if (b - a).days == 1:
            run += 1
        else:
            runs.append(run)
            run = 1
    runs.append(run)
    print("activity days:", len(days), "runs:", runs, "record:", max(runs), "last run:", runs[-1], file=sys.stderr)
    missing = [d for d in A if d not in set(days)]
    print("uncovered active days:", missing, file=sys.stderr)
    for r in done:
        ppd = r.events[-1][1] / max(1, (r.events[-1][2] - r.start_day).days + 1)
        if ppd > 130:
            print("high pages/day:", r.key, round(ppd), file=sys.stderr)

if __name__ == "__main__":
    sql, readings = generate()
    report(readings)
    if "--check" not in sys.argv:
        sys.stdout.write(sql)
