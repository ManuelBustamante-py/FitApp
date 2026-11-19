import { describe, expect, it } from "vitest";

import { loadFoods } from "./load.ts";
import type { NormalizedFood } from "./normalize.ts";

type Row = Record<string, unknown>;

/**
 * Doble mínimo del cliente de Supabase en memoria: solo las operaciones que usa
 * loadFoods (select/eq/in, upsert por id, insert, delete/in).
 */
class FakeDb {
  tables: Record<string, Row[]> = { food: [], food_nutrient: [], food_portion: [] };
  failInsertFor = new Set<string>();

  from(table: string) {
    return new Query(this, table);
  }
}

/** Consulta "thenable", como el builder de supabase-js. */
class Query {
  private filters: ((row: Row) => boolean)[] = [];
  private op: "select" | "delete" = "select";

  constructor(
    private db: FakeDb,
    private table: string,
  ) {}

  select() {
    this.op = "select";
    return this;
  }

  delete() {
    this.op = "delete";
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push((row) => row[column] === value);
    return this;
  }

  in(column: string, values: unknown[]) {
    this.filters.push((row) => values.includes(row[column]));
    return this;
  }

  upsert(rows: Row[]) {
    const table = this.db.tables[this.table];
    for (const row of rows) {
      const i = table.findIndex((r) => r.id === row.id);
      if (i >= 0) table[i] = { ...table[i], ...row };
      else table.push({ ...row });
    }
    return Promise.resolve({ data: null, error: null });
  }

  insert(rows: Row[]) {
    if (rows.some((r) => this.db.failInsertFor.has(String(r.food_id)))) {
      return Promise.resolve({ data: null, error: { message: "fallo simulado" } });
    }
    this.db.tables[this.table].push(...rows.map((r) => ({ ...r })));
    return Promise.resolve({ data: null, error: null });
  }

  then(
    resolve?: (value: { data: Row[] | null; error: null }) => unknown,
    reject?: (reason: unknown) => unknown,
  ) {
    const match = (row: Row) => this.filters.every((f) => f(row));
    const table = this.db.tables[this.table];
    if (this.op === "delete") {
      this.db.tables[this.table] = table.filter((row) => !match(row));
      return Promise.resolve({ data: null, error: null }).then(resolve, reject);
    }
    return Promise.resolve({ data: table.filter(match), error: null }).then(
      resolve,
      reject,
    );
  }
}

const base: NormalizedFood = {
  source: "usda_fdc",
  sourceId: "1",
  nameEs: "Manzana, cruda",
  nameEn: "Apples, raw",
  category: "Frutas y jugos de fruta",
  state: "crudo",
  basis: "per_100g",
  license: "CC0 / dominio público",
  nutrients: { energy_kcal: 52, protein_g: 0.26 },
  portions: [
    { sourcePortionId: "10", labelEs: "1 unidad mediana", grams: 182 },
    { sourcePortionId: "11", labelEs: "1 taza, en rebanadas", grams: 109 },
  ],
};

const nutrientIds = new Map([
  ["energy_kcal", 1],
  ["protein_g", 2],
]);

async function load(db: FakeDb, foods: NormalizedFood[], batchSize = 500) {
  // El doble implementa solo lo necesario del cliente tipado.
  return loadFoods(db as never, foods, { nutrientIds, batchSize });
}

describe("loadFoods (doble en memoria)", () => {
  it("es idempotente: dos cargas dejan las mismas filas y los mismos ids", async () => {
    const db = new FakeDb();
    const second = { ...base, sourceId: "2", nameEs: "Pera, cruda" };
    expect(await load(db, [base, second], 1)).toEqual({ loaded: 2, errors: [] });
    const snapshot = structuredClone({
      food: db.tables.food.map((f) => f.id),
      nutrients: db.tables.food_nutrient.length,
      portions: db.tables.food_portion.map((p) => p.id),
    });

    expect(await load(db, [base, second])).toEqual({ loaded: 2, errors: [] });
    expect(db.tables.food.map((f) => f.id)).toEqual(snapshot.food);
    expect(db.tables.food_nutrient).toHaveLength(4);
    expect(db.tables.food_portion.map((p) => p.id).sort()).toEqual(
      [...snapshot.portions].sort(),
    );
  });

  it("actualiza los datos y borra las porciones y nutrientes que ya no vienen", async () => {
    const db = new FakeDb();
    await load(db, [base]);
    const [portionKept] = db.tables.food_portion;
    await load(db, [
      {
        ...base,
        nameEs: "Manzana con cáscara, cruda",
        nutrients: { energy_kcal: 53 },
        portions: [base.portions[0]],
      },
    ]);
    expect(db.tables.food).toHaveLength(1);
    expect(db.tables.food[0].name_es).toBe("Manzana con cáscara, cruda");
    expect(db.tables.food_nutrient).toEqual([
      { food_id: db.tables.food[0].id, nutrient_id: 1, amount_per_100: 53 },
    ]);
    expect(db.tables.food_portion).toEqual([portionKept]);
  });

  it("aísla el alimento que falla y carga el resto del lote", async () => {
    const db = new FakeDb();
    await load(db, [base]);
    db.failInsertFor.add(String(db.tables.food[0].id));
    const other = { ...base, sourceId: "2" };
    const result = await load(db, [base, other]);
    expect(result.loaded).toBe(1);
    expect(result.errors).toEqual([
      {
        source: "usda_fdc",
        sourceId: "1",
        nameEn: "Apples, raw",
        error: "insertar food_nutrient: fallo simulado",
      },
    ]);
  });
});
