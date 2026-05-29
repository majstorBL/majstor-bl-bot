const BASE_URL = "http://localhost:3000";

const tests = [
  // =========================
  // B1 — MONTAŽA NAMJEŠTAJA
  // =========================

  {
    name: "B1 - ormar",
    input: "Trebam montažu ormara",
    expected: ["montažu namještaja"],
  },

  {
    name: "B1 - kuhinjski elementi",
    input: "Treba montaža kuhinjskih elemenata",
    expected: ["montažu namještaja"],
  },

  {
    name: "B1 - polica",
    input: "Treba postaviti policu",
    expected: ["montažu namještaja"],
  },

  {
    name: "B1 - karniša",
    input: "Treba montaža karniše",
    expected: ["montažu namještaja"],
  },

  {
    name: "B1 - garniša",
    input: "Treba postaviti garnišu",
    expected: ["montažu namještaja"],
  },

  {
    name: "B1 - komoda",
    input: "Treba sastaviti komodu",
    expected: ["montažu namještaja"],
  },

  {
    name: "B1 - krevet",
    input: "Treba montaža kreveta",
    expected: ["montažu namještaja"],
  },

  // =========================
  // B2 — ELEKTRO
  // =========================

  {
    name: "B2 - sijalica",
    input: "Sijalica ne svijetli",
    expected: ["manju elektro intervenciju"],
  },

  {
    name: "B2 - žarulja",
    input: "Žarulja ne radi",
    expected: ["manju elektro intervenciju"],
  },

  {
    name: "B2 - svjetlo",
    input: "Ne radi svjetlo u kupatilu",
    expected: ["manju elektro intervenciju"],
  },

  {
    name: "B2 - luster",
    input: "Treba zamijeniti luster",
    expected: ["manju elektro intervenciju"],
  },

  {
    name: "B2 - plafonjera",
    input: "Treba postaviti plafonjeru",
    expected: ["manju elektro intervenciju"],
  },

  {
    name: "B2 - grlo sijalice",
    input: "Pokvareno grlo sijalice",
    expected: ["manju elektro intervenciju"],
  },

  {
    name: "B2 - utičnica",
    input: "Treba zamijeniti utičnicu",
    expected: ["manju elektro intervenciju"],
  },

  {
    name: "B2 - prekidač",
    input: "Ne radi prekidač za svjetlo",
    expected: ["manju elektro intervenciju"],
  },

  {
    name: "B2 - osigurač",
    input: "Izbacuje osigurač",
    expected: ["manju elektro intervenciju"],
  },

  // =========================
  // B3 — VODA
  // =========================

  {
    name: "B3 - sifon",
    input: "Začepljen sifon ispod sudopera",
    expected: ["manju vodoinstalatersku intervenciju"],
  },

  {
    name: "B3 - sudoper odvod",
    input: "U sudoperu mi je začepljen odvod",
    expected: ["manju vodoinstalatersku intervenciju"],
  },

  {
    name: "B3 - lavabo",
    input: "Ne otiče voda iz lavaboa",
    expected: ["manju vodoinstalatersku intervenciju"],
  },

  {
    name: "B3 - pipa",
    input: "Pipa u kuhinji curi",
    expected: ["manju vodoinstalatersku intervenciju"],
  },

  {
    name: "B3 - slavina",
    input: "Treba zamijeniti slavinu",
    expected: ["manju vodoinstalatersku intervenciju"],
  },

  {
    name: "B3 - ventil",
    input: "Ventil za vodu curi",
    expected: ["manju vodoinstalatersku intervenciju"],
  },

  {
    name: "B3 - fleksibilno crijevo",
    input: "Treba zamijeniti fleksibilno crijevo",
    expected: ["manju vodoinstalatersku intervenciju"],
  },

  {
    name: "B3 - vodokotlić",
    input: "Vodokotlić stalno pušta vodu",
    expected: ["manju vodoinstalatersku intervenciju"],
  },

  {
    name: "B3 - tuš baterija",
    input: "Treba zamijeniti tuš bateriju",
    expected: ["manju vodoinstalatersku intervenciju"],
  },

  // =========================
  // B4 — UGRADNJA UREĐAJA
  // =========================

  {
    name: "B4 - bojler",
    input: "Kupio sam bojler, treba ugradnja",
    expected: ["ugradnju/priključenje uređaja"],
  },

  {
    name: "B4 - šporet",
    input: "Treba priključiti šporet",
    expected: ["ugradnju/priključenje uređaja"],
  },

  {
    name: "B4 - ploča",
    input: "Treba ugradnja ploče za kuhanje",
    expected: ["ugradnju/priključenje uređaja"],
  },

  {
    name: "B4 - napa",
    input: "Treba postaviti napu",
    expected: ["ugradnju/priključenje uređaja"],
  },

  {
    name: "B4 - sudomašina",
    input: "Treba priključiti sudomašinu",
    expected: ["ugradnju/priključenje uređaja"],
  },

  {
    name: "B4 - veš mašina",
    input: "Treba spojiti veš mašinu",
    expected: ["ugradnju/priključenje uređaja"],
  },

  // =========================
  // DEMONTAŽA
  // =========================

  {
    name: "Demontaža - rastaviti stari ormar",
    input:
      "Trebam montažu ormara. Stari treba rastaviti i skloniti, a novi montirati.",
    expected: ["montažu namještaja"],
    notExpected: ["Da li je prostor pripremljen"],
  },

  {
    name: "Demontaža - demontaža ormara",
    input: "Trebam demontažu starog ormara i montažu novog.",
    expected: ["montažu namještaja"],
    notExpected: ["Da li je prostor pripremljen"],
  },

  {
    name: "Demontaža - ukloniti stari",
    input: "Treba ukloniti stari ormar pa montirati novi.",
    expected: ["montažu namještaja"],
    notExpected: ["Da li je prostor pripremljen"],
  },

  {
    name: "Already removed",
    input: "Stari ormar je demontiran i sklonjen.",
    notExpected: ["demontažu"],
  },

  // =========================
  // OUT OF SCOPE
  // =========================

  {
    name: "OOS - kanalizacija",
    input: "Začepljena kanalizacija u zidu",
    expected: ["Žao nam je"],
  },

  {
    name: "OOS - nova elektro instalacija",
    input: "Treba nova elektro instalacija u stanu",
    expected: ["Žao nam je"],
  },

  {
    name: "OOS - štemanje zidova",
    input: "Treba štemanje zidova i provlačenje kablova",
    expected: ["Žao nam je"],
  },

  {
    name: "OOS - cijevi u zidu",
    input: "Pukla je vodovodna cijev u zidu",
    expected: ["Žao nam je"],
  },
];

async function call(path) {
  const res = await fetch(`${BASE_URL}${path}`);
  return await res.text();
}

async function run() {
  let passed = 0;
  let failed = 0;

  for (let i = 0; i < tests.length; i++) {
    const test = tests[i];
    const userId = `test-${Date.now()}-${i}`;

    await call(`/reset?userId=${encodeURIComponent(userId)}`);

    const reply = await call(
      `/next?userId=${encodeURIComponent(userId)}&tekst=${encodeURIComponent(
        test.input,
      )}`,
    );

    const okExpected = (test.expected || []).every((text) =>
      reply.includes(text),
    );

    const okNotExpected = (test.notExpected || []).every(
      (text) => !reply.includes(text),
    );

    if (okExpected && okNotExpected) {
      console.log(`✅ PASS: ${test.name}`);
      passed++;
    } else {
      console.log(`❌ FAIL: ${test.name}`);
      console.log(`   Input: ${test.input}`);
      console.log(`   Reply: ${reply}`);
      console.log("");
      failed++;
    }
  }

  console.log("---------------------");
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
}

run().catch((err) => {
  console.error("Test error:", err);
});
