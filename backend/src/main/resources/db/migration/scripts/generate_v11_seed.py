#!/usr/bin/env python3
"""Deterministic generator for Flyway migration V11__more_seed_data.sql.

Purpose
-------
Grows the StayHub property catalog to 30 properties per city for
Barcelona, Madrid, Sevilla (new) and Lisbon, each with several real photos,
and upgrades the 15 existing V7 properties from placehold.co gray boxes to
real photos.

Output
------
Running this script writes ``V11__more_seed_data.sql`` next to the other
migrations (``backend/src/main/resources/db/migration/``). The output is a
pure function of this script's constants and per-index arithmetic -- there is
NO use of the nondeterministic ``random`` module, so re-running it produces a
byte-for-byte identical file (``git diff`` stays clean on a second run).

How to regenerate
-----------------
    python3 backend/src/main/resources/db/migration/scripts/generate_v11_seed.py

It overwrites V11__more_seed_data.sql in place. Commit BOTH this script and the
generated SQL.

How to swap the photo source
----------------------------
All photo URLs are produced by the single ``photo_url(keywords, lock)``
function below. To switch from LoremFlickr to Picsum (the documented one-line
fallback if LoremFlickr ever flakes), change only that function -- see the
comment inside it -- and regenerate.

Determinism contract
---------------------
Every per-property value (host rotation, coordinates jitter, type, capacity,
prices, amenities, house rules, photos, rating, timestamps) is derived purely
from the property's stable integer index and city. No global RNG state.
"""

from pathlib import Path

# ---------------------------------------------------------------------------
# City definitions
# ---------------------------------------------------------------------------
# c-code: 1=BCN, 2=MAD, 3=LIS, 4=SEV  (matches V7's CC convention; SEV is new)
# Centre coordinates are (lat, lng). PostGIS wants lng FIRST in ST_MakePoint.
CITIES = [
    {
        "code": 1,
        "city": "Barcelona",
        "region": "Catalonia",
        "country": "ES",
        "lat": 41.3874,
        "lng": 2.1686,
        "count": 25,
        "postcode_base": 8000,
        "streets": [
            "Carrer de Provenca", "Carrer de Mallorca", "Carrer del Consell de Cent",
            "Carrer de Arago", "Carrer de Valencia", "Passeig de Gracia",
            "Rambla de Catalunya", "Carrer de Balmes", "Carrer de Muntaner",
            "Carrer de Pau Claris",
        ],
        "neighbourhoods": [
            "Eixample", "Gracia", "El Born", "Gothic Quarter", "Poblenou",
            "Sant Antoni", "Sarria", "Sants", "El Raval", "Barceloneta",
        ],
    },
    {
        "code": 2,
        "city": "Madrid",
        "region": "Madrid",
        "country": "ES",
        "lat": 40.4168,
        "lng": -3.7038,
        "count": 25,
        "postcode_base": 28000,
        "streets": [
            "Calle Mayor", "Calle de Alcala", "Gran Via", "Calle de Serrano",
            "Calle de Fuencarral", "Calle de Atocha", "Calle de Goya",
            "Calle de Velazquez", "Calle de Bravo Murillo", "Paseo de la Castellana",
        ],
        "neighbourhoods": [
            "Sol", "Malasana", "Salamanca", "Chamberi", "La Latina",
            "Chueca", "Lavapies", "Retiro", "Chamartin", "Arganzuela",
        ],
    },
    {
        "code": 3,
        "city": "Lisbon",
        "region": "Lisbon",
        "country": "PT",
        "lat": 38.7223,
        "lng": -9.1393,
        "count": 25,
        "postcode_base": 1100,
        "streets": [
            "Rua dos Remedios", "Rua da Atalaia", "Rua Augusta", "Rua do Carmo",
            "Avenida da Liberdade", "Rua da Prata", "Rua de Sao Bento",
            "Rua da Madalena", "Rua do Ouro", "Rua de Belem",
        ],
        "neighbourhoods": [
            "Alfama", "Bairro Alto", "Chiado", "Principe Real", "Belem",
            "Graca", "Mouraria", "Estrela", "Alcantara", "Baixa",
        ],
    },
    {
        "code": 4,
        "city": "Sevilla",
        "region": "Andalusia",
        "country": "ES",
        "lat": 37.3891,
        "lng": -5.9845,
        "count": 30,
        "postcode_base": 41000,
        "streets": [
            "Calle Sierpes", "Calle Betis", "Avenida de la Constitucion",
            "Calle San Jacinto", "Calle Feria", "Calle Tetuan",
            "Calle Alfalfa", "Calle Regina", "Calle Pureza", "Calle Castilla",
        ],
        "neighbourhoods": [
            "Santa Cruz", "Triana", "Alameda", "Arenal", "Macarena",
            "Nervion", "Alfalfa", "San Lorenzo", "El Arenal", "Los Remedios",
        ],
    },
]

# ---------------------------------------------------------------------------
# Templated content pools (all selected deterministically from the index).
# ---------------------------------------------------------------------------
ADJECTIVES = ["Sunny", "Cosy", "Modern", "Charming", "Elegant", "Bright",
              "Stylish", "Quiet", "Spacious", "Rustic"]

# Property types and the noun used in the title. Apartment/studio weighted
# higher by appearing more often in the rotation list.
TYPE_ROTATION = [
    ("apartment", "Apartment"),
    ("studio", "Studio"),
    ("apartment", "Loft"),
    ("house", "Townhouse"),
    ("studio", "Studio"),
    ("apartment", "Flat"),
    ("villa", "Villa"),
    ("apartment", "Apartment"),
    ("cabin", "Cabin"),
    ("studio", "Studio"),
]

HOSTS = [
    "aaaaaaaa-aaaa-aaaa-aaaa-000000000001",
    "aaaaaaaa-aaaa-aaaa-aaaa-000000000002",
    "aaaaaaaa-aaaa-aaaa-aaaa-000000000003",
]

AMENITY_POOL = ["wifi", "kitchen", "air_conditioning", "heating", "washer",
                "pool", "parking", "tv", "workspace", "balcony", "elevator"]

HOUSE_RULE_POOL = ["no_smoking", "no_parties", "no_pets", "quiet_hours"]

DESCRIPTION_TEMPLATES = [
    "Comfortable {type} in {neighbourhood}, close to the best of {city}.",
    "Well-located {type} in {neighbourhood} with easy access to public transport.",
    "Bright and welcoming {type} in the heart of {neighbourhood}, {city}.",
    "A relaxing {type} in {neighbourhood}, perfect for exploring {city}.",
    "Stylish {type} in {neighbourhood} with everything you need for a great stay.",
]

# Room slots: (keyword fragment, caption). Photos cycle through these.
ROOM_SLOTS = [
    ("interior", "Living room"),
    ("bedroom", "Bedroom"),
    ("kitchen", "Kitchen"),
    ("living-room", "Living area"),
    ("terrace,view", "View"),
    ("bathroom", "Bathroom"),
]

# Fixed base timestamp so created_at/updated_at are deterministic.
BASE_DATE = "2025-04-01 12:00:00+00"


# ---------------------------------------------------------------------------
# Photo source -- the ONE place to change to swap providers.
# ---------------------------------------------------------------------------
def photo_url(keywords: str, lock: int) -> str:
    """Return a stable, topical photo URL.

    Default: LoremFlickr keyworded with a unique ``lock`` per (property, index)
    so images are distinct and stable across runs.

        https://loremflickr.com/800/600/{keywords}?lock={n}

    TO SWAP THE PHOTO SOURCE: replace the return line below with Picsum, e.g.

        return f"https://picsum.photos/seed/{lock}/800/600"

    ...and regenerate. Nothing else needs to change.
    """
    return f"https://loremflickr.com/800/600/{keywords}?lock={lock}"


def type_keywords(property_type: str, room_fragment: str) -> str:
    """Combine the property type with a room fragment for richer keywords."""
    # villa/cabin get an outdoor flavour on the first slot via room_fragment.
    return f"{property_type},{room_fragment}"


# ---------------------------------------------------------------------------
# Determinism helpers -- all derived from the integer index, no RNG.
# ---------------------------------------------------------------------------
def jitter(idx: int, salt: int) -> float:
    """Deterministic offset in roughly [-0.03, +0.03] degrees.

    Uses a fixed multiplicative hash on (idx, salt) mapped into the range.
    No randomness; identical for the same inputs every run.
    """
    h = (idx * 73856093) ^ (salt * 19349663)
    frac = (h % 6001) / 6000.0  # 0.0 .. 1.0
    return round((frac - 0.5) * 0.06, 6)  # -0.03 .. +0.03


def sql_escape(text: str) -> str:
    """Escape single quotes for SQL string literals (double them)."""
    return text.replace("'", "''")


def subset(pool, idx: int, salt: int, min_n: int, max_n: int):
    """Deterministic subset of ``pool`` with between min_n and max_n items,
    preserving pool order so the JSON arrays look natural."""
    span = max_n - min_n + 1
    n = min_n + ((idx * 2654435761 ^ salt * 40503) % span)
    # Rotating start offset so different properties pick different members.
    start = (idx * 2246822519 ^ salt) % len(pool)
    chosen = []
    i = 0
    while len(chosen) < n and i < len(pool):
        item = pool[(start + i) % len(pool)]
        if item not in chosen:
            chosen.append(item)
        i += 1
    # Re-sort by pool order for stable, natural-looking output.
    return [x for x in pool if x in chosen]


def json_str_array(items) -> str:
    """Render a list of strings as a compact JSON array literal."""
    inner = ",".join('"' + sql_escape(x) + '"' for x in items)
    return "[" + inner + "]"


# ---------------------------------------------------------------------------
# Photo array builder
# ---------------------------------------------------------------------------
def build_photos(property_type: str, lock_base: int, count: int) -> str:
    """Build a JSON array of {url,caption,order} photo objects.

    ``lock_base`` makes every (property, photo index) pair unique so LoremFlickr
    returns distinct, stable images. ``count`` is 3..5 for new properties,
    3..4 for the existing-property refresh.
    """
    objs = []
    for i in range(count):
        room_fragment, caption = ROOM_SLOTS[i % len(ROOM_SLOTS)]
        if i == 0:
            keywords = type_keywords(property_type, room_fragment)
        else:
            keywords = room_fragment
        lock = lock_base + i
        url = photo_url(keywords, lock)
        objs.append(
            '{"url":"' + url + '","caption":"' + caption + '","order":' + str(i + 1) + "}"
        )
    return "[" + ",".join(objs) + "]"


# ---------------------------------------------------------------------------
# New property row generation
# ---------------------------------------------------------------------------
def generate_property_row(city: dict, n: int) -> str:
    """Generate one property VALUES tuple for the given city and 1-based index.

    ``n`` runs 1..count within the city. The global ``idx`` mixes the city code
    so locks/jitter are unique across cities.
    """
    code = city["code"]
    # 12-hex-digit UUID tail: 0000000 (7) + code (1) + nnn (4) = 12 digits.
    # This never collides with V7 booking IDs (dddddddd-...-00000000000N) since
    # those end in 0000000000 0N while ours has a nonzero city digit in slot 8.
    nnn = f"{n:04d}"
    uid = f"dddddddd-dddd-dddd-dddd-0000000{code}{nnn}"

    # Stable global index for hashing (unique per city+n).
    idx = code * 1000 + n

    host = HOSTS[(n - 1) % len(HOSTS)]

    ptype, noun = TYPE_ROTATION[(n - 1) % len(TYPE_ROTATION)]
    neighbourhood = city["neighbourhoods"][(n - 1) % len(city["neighbourhoods"])]
    adjective = ADJECTIVES[(idx) % len(ADJECTIVES)]

    title = f"{adjective} {neighbourhood} {noun}"

    description = DESCRIPTION_TEMPLATES[(idx) % len(DESCRIPTION_TEMPLATES)].format(
        type=noun.lower(), neighbourhood=neighbourhood, city=city["city"]
    )

    lat = round(city["lat"] + jitter(idx, 11), 6)
    lng = round(city["lng"] + jitter(idx, 29), 6)

    # Address: street + number + postcode + city.
    street = city["streets"][(idx) % len(city["streets"])]
    number = 1 + (idx * 7) % 250
    postcode = city["postcode_base"] + 1 + (idx % 999)
    address = f"{street} {number}, {postcode} {city['city']}"

    # Capacity / pricing -- deterministic, respecting CHECK constraints.
    if ptype == "studio":
        bedrooms = 0
        max_guests = 1 + (idx % 2) + 1  # 2..3
        bathrooms = 1
    elif ptype == "villa":
        bedrooms = 3 + (idx % 2)  # 3..4
        max_guests = 6 + (idx % 3)  # 6..8
        bathrooms = 2 + (idx % 2)  # 2..3
    elif ptype == "house":
        bedrooms = 2 + (idx % 3)  # 2..4
        max_guests = 4 + (idx % 4)  # 4..7
        bathrooms = 1 + (idx % 3)  # 1..3
    elif ptype == "cabin":
        bedrooms = 1 + (idx % 3)  # 1..3
        max_guests = 2 + (idx % 4)  # 2..5
        bathrooms = 1 + (idx % 2)  # 1..2
    else:  # apartment / loft / flat
        bedrooms = 1 + (idx % 3)  # 1..3
        max_guests = 2 + (idx % 4)  # 2..5
        bathrooms = 1 + (idx % 2)  # 1..2

    # nightly_rate ~45..320, scaled a bit by capacity for plausibility.
    base_rate = 45 + (idx * 13) % 200  # 45..244
    rate = base_rate + bedrooms * 18
    rate = min(rate, 320)
    nightly_rate = f"{rate:.2f}"

    # cleaning_fee ~15..80.
    cleaning = 15 + (idx * 5) % 66  # 15..80
    cleaning_fee = f"{cleaning:.2f}"

    amenities = subset(AMENITY_POOL, idx, 3, 3, 7)
    # Pool only makes sense for villa/house; keep it natural but deterministic.
    if ptype not in ("villa", "house") and "pool" in amenities:
        amenities = [a for a in amenities if a != "pool"]
        if "balcony" not in amenities:
            amenities.append("balcony")
        amenities = [a for a in AMENITY_POOL if a in amenities]
    house_rules = subset(HOUSE_RULE_POOL, idx, 7, 1, 3)

    # 3..5 photos. lock_base unique per property (idx*10 leaves room for index).
    photo_count = 3 + (idx % 3)  # 3..5
    lock_base = 100000 + idx * 10
    photos = build_photos(ptype, lock_base, photo_count)

    # avg_rating 4.0..5.0 (one decimal).
    rating = 4.0 + (idx % 11) / 10.0  # 4.0 .. 5.0
    avg_rating = f"{rating:.1f}"

    return (
        f"    ('{uid}'::uuid,\n"
        f"     '{host}'::uuid,\n"
        f"     '{sql_escape(title)}',\n"
        f"     '{sql_escape(description)}',\n"
        f"     '{ptype}',\n"
        f"     ST_SetSRID(ST_MakePoint({lng}, {lat}), 4326)::geography,\n"
        f"     '{sql_escape(city['city'])}', '{sql_escape(city['region'])}', '{city['country']}',\n"
        f"     '{sql_escape(address)}',\n"
        f"     {max_guests}, {bedrooms}, {bathrooms},\n"
        f"     {nightly_rate}, {cleaning_fee},\n"
        f"     '{json_str_array(amenities)}'::jsonb,\n"
        f"     '{json_str_array(house_rules)}'::jsonb,\n"
        f"     '{photos}'::jsonb,\n"
        f"     {avg_rating}, 0, true,\n"
        f"     '{BASE_DATE}', '{BASE_DATE}')"
    )


# ---------------------------------------------------------------------------
# Existing-property photo refresh (the 15 V7 cccc... IDs)
# ---------------------------------------------------------------------------
EXISTING_PROPERTIES = [
    # (id, property_type) -- type drives the first photo's keywords.
    ("cccccccc-cccc-cccc-cccc-000000001001", "apartment"),
    ("cccccccc-cccc-cccc-cccc-000000001002", "studio"),
    ("cccccccc-cccc-cccc-cccc-000000001003", "house"),
    ("cccccccc-cccc-cccc-cccc-000000001004", "apartment"),
    ("cccccccc-cccc-cccc-cccc-000000001005", "villa"),
    ("cccccccc-cccc-cccc-cccc-000000002001", "apartment"),
    ("cccccccc-cccc-cccc-cccc-000000002002", "studio"),
    ("cccccccc-cccc-cccc-cccc-000000002003", "apartment"),
    ("cccccccc-cccc-cccc-cccc-000000002004", "house"),
    ("cccccccc-cccc-cccc-cccc-000000002005", "cabin"),
    ("cccccccc-cccc-cccc-cccc-000000003001", "apartment"),
    ("cccccccc-cccc-cccc-cccc-000000003002", "studio"),
    ("cccccccc-cccc-cccc-cccc-000000003003", "apartment"),
    ("cccccccc-cccc-cccc-cccc-000000003004", "house"),
    ("cccccccc-cccc-cccc-cccc-000000003005", "villa"),
]


def generate_update_statement(seq: int, uid: str, ptype: str) -> str:
    """One UPDATE refreshing an existing property's photos (3..4 photos)."""
    photo_count = 3 + (seq % 2)  # 3..4
    lock_base = 900000 + seq * 10
    photos = build_photos(ptype, lock_base, photo_count)
    return (
        f"UPDATE property SET photos = '{photos}'::jsonb "
        f"WHERE id = '{uid}'::uuid;"
    )


# ---------------------------------------------------------------------------
# Assemble the migration file
# ---------------------------------------------------------------------------
def build_sql() -> str:
    out = []
    out.append("-- V11__more_seed_data.sql")
    out.append("--")
    out.append("-- GENERATED FILE -- do not edit by hand.")
    out.append("-- Regenerate with:")
    out.append("--   python3 backend/src/main/resources/db/migration/scripts/generate_v11_seed.py")
    out.append("--")
    out.append("-- Grows the catalog to 30 properties per city for Barcelona, Madrid,")
    out.append("-- Sevilla (new) and Lisbon (105 new properties total), each with 3-5 real")
    out.append("-- photos, and upgrades the 15 existing V7 properties from placehold.co gray")
    out.append("-- boxes to real photos.")
    out.append("--")
    out.append("-- Conventions (mirroring V7):")
    out.append("--   * Deterministic UUIDs. New properties use the d... namespace with a")
    out.append("--     nonzero city digit so they never collide with V7's cccc... properties")
    out.append("--     nor V7's dddd...-00000000000N booking IDs:")
    out.append("--       dddddddd-dddd-dddd-dddd-0000000CNNNN  (C: 1=BCN,2=MAD,3=LIS,4=SEV)")
    out.append("--   * host_id rotates the 3 existing V7 hosts.")
    out.append("--   * location stored as PostGIS geography (SRID 4326), lng first.")
    out.append("--   * photos are LoremFlickr URLs with a unique lock per (property, index)")
    out.append("--     so images are distinct and stable. Swap the source in one place via")
    out.append("--     the generator's photo_url() function (Picsum fallback documented there).")
    out.append("--   * review_count = 0 (no review rows seeded here, mirroring V7's display).")
    out.append("")

    # ---- Section A: new properties --------------------------------------
    out.append("-- ---------------------------------------------------------------------------")
    out.append("-- A. New properties -- reaching 30 per city")
    out.append("--    Barcelona +25, Madrid +25, Lisbon +25, Sevilla +30 (105 new total).")
    out.append("-- ---------------------------------------------------------------------------")
    out.append("INSERT INTO property (")
    out.append("    id, host_id, title, description, property_type, location,")
    out.append("    city, region, country, address,")
    out.append("    max_guests, bedrooms, bathrooms,")
    out.append("    nightly_rate_eur, cleaning_fee_eur,")
    out.append("    amenities, house_rules, photos,")
    out.append("    avg_rating, review_count, is_active,")
    out.append("    created_at, updated_at")
    out.append(") VALUES")

    rows = []
    for city in CITIES:
        rows.append(
            f"    -- ---- {city['city']} (+{city['count']}) "
            + "-" * max(0, 40 - len(city["city"]))
        )
        for n in range(1, city["count"] + 1):
            rows.append(generate_property_row(city, n))
    # Join rows: comments stand on their own line; value tuples are comma-sep.
    # Build a single INSERT terminated by ';'. Comments interleave but each
    # value row must be comma-separated from the next value row.
    rendered = []
    value_rows = []  # collect (is_comment, text)
    for r in rows:
        is_comment = r.lstrip().startswith("--")
        value_rows.append((is_comment, r))

    # Emit, placing commas after value tuples (not after the last one).
    last_value_index = max(i for i, (c, _) in enumerate(value_rows) if not c)
    for i, (is_comment, text) in enumerate(value_rows):
        if is_comment:
            rendered.append(text)
        else:
            sep = ";" if i == last_value_index else ","
            rendered.append(text + sep)
    out.extend(rendered)
    out.append("")

    # ---- Section B: refresh existing 15 photos --------------------------
    out.append("-- ---------------------------------------------------------------------------")
    out.append("-- B. Upgrade the 15 existing V7 properties' photos to real LoremFlickr images")
    out.append("--    (replacing the placehold.co gray boxes). Same {url,caption,order} shape.")
    out.append("-- ---------------------------------------------------------------------------")
    for seq, (uid, ptype) in enumerate(EXISTING_PROPERTIES, start=1):
        out.append(generate_update_statement(seq, uid, ptype))
    out.append("")

    return "\n".join(out)


def main() -> None:
    migration_dir = Path(__file__).resolve().parent.parent
    target = migration_dir / "V11__more_seed_data.sql"
    sql = build_sql()
    target.write_text(sql, encoding="utf-8")
    print(f"Wrote {target}")


if __name__ == "__main__":
    main()
