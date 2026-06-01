const http = require("http");

const BASE_URL = "http://localhost:3000";

const tests = [
  // ─────────────────────────────────────────────
  // B1 — NAMJEŠTAJ / MONTAŽA / DEMONTAŽA
  // ─────────────────────────────────────────────

  {
    name: "B1 - montaža ormara",
    steps: [
      {
        input: "Trebam montažu ormara.",
        expected: ["montažu namještaja"],
        notExpected: ["O kojoj vrsti radova"],
      },
    ],
  },
  {
    name: "B1 - sastaviti ormar",
    steps: [
      {
        input: "Treba sastaviti ormar.",
        expected: ["montažu namještaja"],
        notExpected: ["O kojoj vrsti radova"],
      },
    ],
  },
  {
    name: "B1 - uklanjanje regala i montaža novog",
    steps: [
      {
        input: "Trebam uklanjanje regala i montažu novog.",
        expected: ["montažu namještaja"],
        notExpected: ["Da li je prostor pripremljen", "O kojoj vrsti radova"],
      },
    ],
  },
  {
    name: "B1 - rastaviti stari regal i sastaviti novi",
    steps: [
      {
        input: "Treba rastaviti stari regal i sastaviti novi.",
        expected: ["montažu namještaja"],
        notExpected: ["Da li je prostor pripremljen", "O kojoj vrsti radova"],
      },
    ],
  },
  {
    name: "B1 - montaža regala",
    steps: [
      {
        input: "Trebam montažu regala.",
        expected: ["montažu namještaja"],
        notExpected: ["O kojoj vrsti radova"],
      },
    ],
  },
  {
    name: "B1 - postaviti policu",
    steps: [
      {
        input: "Treba postaviti policu.",
        expected: ["montažu namještaja"],
        notExpected: ["O kojoj vrsti radova"],
      },
    ],
  },
  {
    name: "B1 - montaža kuhinjskih elemenata",
    steps: [
      {
        input: "Treba montaža kuhinjskih elemenata.",
        expected: ["montažu namještaja"],
        notExpected: ["O kojoj vrsti radova"],
      },
    ],
  },
  {
    name: "B1 - montaža kuhinjskih elemenata i uklanjanje starih",
    steps: [
      {
        input: "Treba montaža kuhinjskih elemenata i uklanjanje starih.",
        expected: ["montažu namještaja"],
        notExpected: ["Da li je prostor pripremljen", "O kojoj vrsti radova"],
      },
    ],
  },
  {
    name: "B1 - postaviti novu viseću kuhinju i ukloniti staru",
    steps: [
      {
        input: "Trebam da mi postavite novu viseću kuhinju a uklonite staru.",
        expected: ["montažu namještaja"],
        notExpected: ["Da li je prostor pripremljen", "O kojoj vrsti radova"],
      },
    ],
  },
  {
    name: "B1 - montaža viseće kuhinje i uklanjanje stare",
    steps: [
      {
        input: "Trebam montažu viseće kuhinje, a uklanjanje stare.",
        expected: ["montažu namještaja"],
        notExpected: ["Da li je prostor pripremljen", "O kojoj vrsti radova"],
      },
    ],
  },
  {
    name: "B1 - montaža kuhinjskog bloka",
    steps: [
      {
        input: "Treba montaža kuhinjskog bloka.",
        expected: ["montažu namještaja"],
        notExpected: ["O kojoj vrsti radova"],
      },
    ],
  },
  {
    name: "B1 - postaviti viseće elemente",
    steps: [
      {
        input: "Treba postaviti viseće elemente.",
        expected: ["montažu namještaja"],
        notExpected: ["O kojoj vrsti radova"],
      },
    ],
  },
  {
    name: "B1 - montaža komode",
    steps: [
      {
        input: "Treba montaža komode.",
        expected: ["montažu namještaja"],
        notExpected: ["O kojoj vrsti radova"],
      },
    ],
  },
  {
    name: "B1 - sastaviti krevet",
    steps: [
      {
        input: "Treba sastaviti krevet.",
        expected: ["montažu namještaja"],
        notExpected: ["O kojoj vrsti radova"],
      },
    ],
  },
  {
    name: "B1 - sastaviti radni sto",
    steps: [
      {
        input: "Treba sastaviti radni sto.",
        expected: ["montažu namještaja"],
        notExpected: ["O kojoj vrsti radova"],
      },
    ],
  },
  {
    name: "B1 - karnišle i uklanjanje starih",
    steps: [
      {
        input: "Trebam postavljanje novih karnišli, a uklanjanje starih.",
        expected: ["montažu namještaja"],
        notExpected: ["Da li je prostor pripremljen", "O kojoj vrsti radova"],
      },
    ],
  },
  {
    name: "B1 - montaža karniše",
    steps: [
      {
        input: "Treba montaža karniše.",
        expected: ["montažu namještaja"],
        notExpected: ["O kojoj vrsti radova"],
      },
    ],
  },
  {
    name: "B1 - postaviti garnišle",
    steps: [
      {
        input: "Treba postaviti garnišle.",
        expected: ["montažu namještaja"],
        notExpected: ["O kojoj vrsti radova"],
      },
    ],
  },
  {
    name: "B1 - garnišle i skinuti stare",
    steps: [
      {
        input: "Treba postaviti garnišle i skinuti stare.",
        expected: ["montažu namještaja"],
        notExpected: ["Da li je prostor pripremljen", "O kojoj vrsti radova"],
      },
    ],
  },
  {
    name: "B1 - ogledalo na zid",
    steps: [
      {
        input: "Treba postaviti ogledalo na zid.",
        expected: ["montažu namještaja"],
        notExpected: ["O kojoj vrsti radova"],
      },
    ],
  },
  {
    name: "B1 - TV nosač",
    steps: [
      {
        input: "Treba postaviti TV nosač.",
        expected: ["montažu namještaja"],
        notExpected: ["O kojoj vrsti radova"],
      },
    ],
  },

  // ─────────────────────────────────────────────
  // B2 — MANJA ELEKTRO INTERVENCIJA
  // ─────────────────────────────────────────────

  {
    name: "B2 - sijalica ne svijetli",
    steps: [
      {
        input: "Sijalica ne svijetli.",
        expected: ["manju elektro intervenciju"],
        notExpected: ["Nisam siguran", "vodoinstalatersku"],
      },
    ],
  },
  {
    name: "B2 - žarulja ne radi",
    steps: [
      {
        input: "Žarulja ne radi.",
        expected: ["manju elektro intervenciju"],
        notExpected: ["Nisam siguran", "vodoinstalatersku"],
      },
    ],
  },
  {
    name: "B2 - ne radi svjetlo u kupatilu",
    steps: [
      {
        input: "Ne radi svjetlo u kupatilu.",
        expected: ["manju elektro intervenciju"],
        notExpected: ["Nisam siguran", "vodoinstalatersku"],
      },
    ],
  },
  {
    name: "B2 - ne radi sijalica u hodniku",
    steps: [
      {
        input: "Ne radi sijalica u hodniku.",
        expected: ["manju elektro intervenciju"],
        notExpected: ["Nisam siguran", "vodoinstalatersku"],
      },
    ],
  },
  {
    name: "B2 - grlo sijalice",
    steps: [
      {
        input: "Pokvareno grlo sijalice.",
        expected: ["manju elektro intervenciju"],
        notExpected: ["Nisam siguran", "vodoinstalatersku"],
      },
    ],
  },
  {
    name: "B2 - zamijeniti luster",
    steps: [
      {
        input: "Treba zamijeniti luster.",
        expected: ["manju elektro intervenciju"],
        notExpected: ["Nisam siguran", "vodoinstalatersku"],
      },
    ],
  },
  {
    name: "B2 - postaviti plafonjeru",
    steps: [
      {
        input: "Treba postaviti plafonjeru.",
        expected: ["manju elektro intervenciju"],
        notExpected: ["Nisam siguran", "vodoinstalatersku"],
      },
    ],
  },
  {
    name: "B2 - zamijeniti utičnicu",
    steps: [
      {
        input: "Treba zamijeniti utičnicu.",
        expected: ["manju elektro intervenciju"],
        notExpected: ["Nisam siguran", "vodoinstalatersku"],
      },
    ],
  },
  {
    name: "B2 - prekidač za svjetlo",
    steps: [
      {
        input: "Ne radi prekidač za svjetlo.",
        expected: ["manju elektro intervenciju"],
        notExpected: ["Nisam siguran", "vodoinstalatersku"],
      },
    ],
  },
  {
    name: "B2 - izbacuje osigurač",
    steps: [
      {
        input: "Izbacuje osigurač.",
        expected: ["manju elektro intervenciju"],
        notExpected: ["problem sa", "vodoinstalatersku"],
      },
    ],
  },
  {
    name: "B2 - osigurač kad upalim svjetlo",
    steps: [
      {
        input: "Iskače osigurač kad upalim svjetlo.",
        expected: ["manju elektro intervenciju"],
        notExpected: ["problem sa", "vodoinstalatersku"],
      },
    ],
  },
  {
    name: "B2 - nema napona u utičnici",
    steps: [
      {
        input: "Nema napona u utičnici.",
        expected: ["manju elektro intervenciju"],
        notExpected: ["Nisam siguran", "vodoinstalatersku"],
      },
    ],
  },

  // B2 UX — kod prijave kvara ne pitati odmah za dio
  {
    name: "B2 UX - ne radi svjetlo ne smije pitati za dio nakon opisa",
    steps: [
      {
        input: "Ne radi svjetlo u kupatilu.",
        expected: ["manju elektro intervenciju"],
      },
      {
        input: "Upalim prekidač, ali se ništa ne desi.",
        notExpected: ["Da li već imate dio"],
      },
    ],
  },
  {
    name: "B2 UX - izbacuje osigurač ne smije pitati za dio nakon opisa",
    steps: [
      {
        input: "Izbacuje osigurač kad upalim svjetlo.",
        expected: ["manju elektro intervenciju"],
      },
      {
        input: "Osigurač padne odmah kad upalim svjetlo.",
        notExpected: ["Da li već imate dio"],
      },
    ],
  },

  // ─────────────────────────────────────────────
  // B3 — MANJA VODOINSTALATERSKA INTERVENCIJA
  // ─────────────────────────────────────────────

  {
    name: "B3 - začepljen sifon ispod sudopera",
    steps: [
      {
        input: "Začepljen sifon ispod sudopera.",
        expected: ["manju vodoinstalatersku intervenciju"],
        notExpected: ["Nisam siguran", "elektro"],
      },
    ],
  },
  {
    name: "B3 - začepljen odvod u sudoperu",
    steps: [
      {
        input: "U sudoperu mi je začepljen odvod.",
        expected: ["manju vodoinstalatersku intervenciju"],
        notExpected: ["Žao nam je", "Nisam siguran"],
      },
    ],
  },
  {
    name: "B3 - ne otiče voda iz lavaboa",
    steps: [
      {
        input: "Ne otiče voda iz lavaboa.",
        expected: ["manju vodoinstalatersku intervenciju"],
        notExpected: ["Žao nam je", "Nisam siguran"],
      },
    ],
  },
  {
    name: "B3 - pipa curi",
    steps: [
      {
        input: "Pipa u kuhinji curi.",
        expected: ["manju vodoinstalatersku intervenciju"],
        notExpected: ["Nisam siguran", "elektro"],
      },
    ],
  },
  {
    name: "B3 - zamijeniti slavinu",
    steps: [
      {
        input: "Treba zamijeniti slavinu.",
        expected: ["manju vodoinstalatersku intervenciju"],
        notExpected: ["Nisam siguran", "elektro"],
      },
    ],
  },
  {
    name: "B3 - ventil curi",
    steps: [
      {
        input: "Ventil za vodu curi.",
        expected: ["manju vodoinstalatersku intervenciju"],
        notExpected: ["Nisam siguran", "elektro"],
      },
    ],
  },
  {
    name: "B3 - fleksibilno crijevo",
    steps: [
      {
        input: "Treba zamijeniti fleksibilno crijevo.",
        expected: ["manju vodoinstalatersku intervenciju"],
        notExpected: ["Nisam siguran", "elektro"],
      },
    ],
  },
  {
    name: "B3 - vodokotlić pušta vodu",
    steps: [
      {
        input: "Vodokotlić stalno pušta vodu.",
        expected: ["manju vodoinstalatersku intervenciju"],
        notExpected: ["Nisam siguran", "elektro"],
      },
    ],
  },
  {
    name: "B3 - tuš baterija",
    steps: [
      {
        input: "Treba zamijeniti tuš bateriju.",
        expected: ["manju vodoinstalatersku intervenciju"],
        notExpected: ["Nisam siguran", "elektro"],
      },
    ],
  },
  {
    name: "B3 - curi ispod lavaboa",
    steps: [
      {
        input: "Curi ispod lavaboa.",
        expected: ["manju vodoinstalatersku intervenciju"],
        notExpected: ["Nisam siguran", "elektro"],
      },
    ],
  },
  {
    name: "B3 - tuš kada realni predmet",
    steps: [
      {
        input: "Treba zamijeniti tuš kadu.",
        expected: ["manju vodoinstalatersku intervenciju"],
        notExpected: ["problem sa veš mašinom", "Nisam siguran"],
      },
    ],
  },

  // B3 UX — kod prijave kvara ne pitati odmah za dio
  {
    name: "B3 UX - curi ispod lavaboa ne smije pitati za dio nakon opisa",
    steps: [
      {
        input: "Curi ispod lavaboa.",
        expected: ["manju vodoinstalatersku intervenciju"],
      },
      {
        input: "Voda curi ispod lavaboa kada pustim vodu.",
        notExpected: ["Da li već imate dio"],
      },
    ],
  },
  {
    name: "B3 UX - začepljen sifon ne smije pitati za dio nakon opisa",
    steps: [
      {
        input: "Začepljen sifon ispod sudopera.",
        expected: ["manju vodoinstalatersku intervenciju"],
      },
      {
        input: "Voda slabo otiče i vraća se u sudoper.",
        notExpected: ["Da li već imate dio"],
      },
    ],
  },

  // ─────────────────────────────────────────────
  // B4 — UGRADNJA / PRIKLJUČENJE UREĐAJA
  // ─────────────────────────────────────────────

  {
    name: "B4 - ugradnja bojlera",
    steps: [
      {
        input: "Kupio sam bojler, treba ugradnja.",
        expected: ["ugradnju/priključenje uređaja"],
        notExpected: ["problem sa bojlerom", "O kojoj vrsti radova"],
      },
    ],
  },
  {
    name: "B4 - priključiti šporet",
    steps: [
      {
        input: "Treba priključiti šporet.",
        expected: ["ugradnju/priključenje uređaja"],
        notExpected: ["problem sa šporetom", "O kojoj vrsti radova"],
      },
    ],
  },
  {
    name: "B4 - ugradnja ploče za kuhanje",
    steps: [
      {
        input: "Treba ugradnja ploče za kuhanje.",
        expected: ["ugradnju/priključenje uređaja"],
        notExpected: ["O kojoj vrsti radova"],
      },
    ],
  },
  {
    name: "B4 - postaviti napu",
    steps: [
      {
        input: "Treba postaviti napu.",
        expected: ["ugradnju/priključenje uređaja"],
        notExpected: ["O kojoj vrsti radova"],
      },
    ],
  },
  {
    name: "B4 - priključiti sudomašinu",
    steps: [
      {
        input: "Treba priključiti sudomašinu.",
        expected: ["ugradnju/priključenje uređaja"],
        notExpected: ["problem sa sudomašinom", "O kojoj vrsti radova"],
      },
    ],
  },
  {
    name: "B4 - spojiti veš mašinu",
    steps: [
      {
        input: "Treba spojiti veš mašinu.",
        expected: ["ugradnju/priključenje uređaja"],
        notExpected: ["problem sa veš mašinom", "O kojoj vrsti radova"],
      },
    ],
  },
  {
    name: "B4 - sudna mašina",
    steps: [
      {
        input: "Treba priključiti sudnu mašinu.",
        expected: ["ugradnju/priključenje uređaja"],
        notExpected: ["problem sa sudomašinom", "O kojoj vrsti radova"],
      },
    ],
  },
  {
    name: "B4 - vešna mašina",
    steps: [
      {
        input: "Treba spojiti vešnu mašinu.",
        expected: ["ugradnju/priključenje uređaja"],
        notExpected: ["problem sa veš mašinom", "O kojoj vrsti radova"],
      },
    ],
  },
  {
    name: "B4 - kuhinjska napa",
    steps: [
      {
        input: "Treba postaviti kuhinjsku napu.",
        expected: ["ugradnju/priključenje uređaja"],
        notExpected: ["O kojoj vrsti radova"],
      },
    ],
  },
  {
    name: "B4 - bojler skinuti stari i ugraditi novi",
    steps: [
      {
        input: "Kupio sam novi bojler, treba skinuti stari i ugraditi novi.",
        expected: ["ugradnju/priključenje uređaja"],
        notExpected: ["Da li je prostor pripremljen", "problem sa bojlerom"],
      },
    ],
  },

  // ─────────────────────────────────────────────
  // DEVICES vs INSTALLATIONS KONFLIKTI
  // ─────────────────────────────────────────────

  {
    name: "DEVICES conflict - veš mašina izbacuje osigurač kada pritisnem dugme",
    steps: [
      {
        input: "Kada na veš mašini stisnem dugme za paljenje, izbaci osigurač.",
        expected: ["problem sa veš mašinom", "brend"],
        notExpected: [
          "manju elektro intervenciju",
          "manju vodoinstalatersku intervenciju",
          "Da li već imate dio",
        ],
      },
    ],
  },
  {
    name: "DEVICES conflict - veš mašina izbacuje osigurač kad je uključim",
    steps: [
      {
        input: "Veš mašina izbacuje osigurač kad je uključim.",
        expected: ["problem sa veš mašinom", "brend"],
        notExpected: ["manju elektro intervenciju", "Da li već imate dio"],
      },
    ],
  },
  {
    name: "DEVICES conflict - mašina izbaci osigurač",
    steps: [
      {
        input: "Mašina izbaci osigurač kad je uključim.",
        expected: ["problem sa veš mašinom", "brend"],
        notExpected: ["manju elektro intervenciju", "Da li već imate dio"],
      },
    ],
  },
  {
    name: "B2 local - izbacuje osigurač kad upalim svjetlo",
    steps: [
      {
        input: "Izbacuje osigurač kad upalim svjetlo.",
        expected: ["manju elektro intervenciju"],
        notExpected: ["problem sa veš mašinom", "vodoinstalatersku"],
      },
    ],
  },

  // ─────────────────────────────────────────────
  // DEMOLITION / REMOVAL MATRIX
  // ─────────────────────────────────────────────

  {
    name: "Removal - demontaža starog ormara",
    steps: [
      {
        input: "Trebam demontažu starog ormara i montažu novog.",
        expected: ["montažu namještaja"],
        notExpected: ["Da li je prostor pripremljen"],
      },
    ],
  },
  {
    name: "Removal - demontirati stari ormar",
    steps: [
      {
        input: "Treba demontirati stari ormar i montirati novi.",
        expected: ["montažu namještaja"],
        notExpected: ["Da li je prostor pripremljen"],
      },
    ],
  },
  {
    name: "Removal - ukloniti stari ormar",
    steps: [
      {
        input: "Treba ukloniti stari ormar i montirati novi.",
        expected: ["montažu namještaja"],
        notExpected: ["Da li je prostor pripremljen"],
      },
    ],
  },
  {
    name: "Removal - skinuti stari bojler i ugraditi novi",
    steps: [
      {
        input: "Treba skinuti stari bojler i ugraditi novi.",
        expected: ["ugradnju/priključenje uređaja"],
        notExpected: ["Da li je prostor pripremljen", "problem sa bojlerom"],
      },
    ],
  },
  {
    name: "Removal - rastavljanje starog namještaja",
    steps: [
      {
        input: "Treba rastavljanje starog namještaja i montaža novog.",
        expected: ["montažu namještaja"],
        notExpected: ["Da li je prostor pripremljen"],
      },
    ],
  },
  {
    name: "Removal - iznijeti stari ormar",
    steps: [
      {
        input: "Treba iznijeti stari ormar i sastaviti novi.",
        expected: ["montažu namještaja"],
        notExpected: ["Da li je prostor pripremljen"],
      },
    ],
  },

  // ─────────────────────────────────────────────
  // ALREADY REMOVED / READY MATRIX
  // ─────────────────────────────────────────────

  {
    name: "Already ready - stari ormar već uklonjen",
    steps: [
      {
        input: "Stari ormar je već uklonjen, treba montirati novi.",
        expected: ["montažu namještaja"],
        notExpected: ["Razumijem da je potrebno i uklanjanje starog predmeta"],
      },
    ],
  },
  {
    name: "Already ready - stari je demontiran i sklonjen",
    steps: [
      {
        input: "Stari ormar je demontiran i sklonjen, treba sastaviti novi.",
        expected: ["montažu namještaja"],
        notExpected: ["Razumijem da je potrebno i uklanjanje starog predmeta"],
      },
    ],
  },
  {
    name: "Already ready - prostor je spreman",
    steps: [
      {
        input: "Prostor je spreman, treba montirati ormar.",
        expected: ["montažu namještaja"],
        notExpected: ["Razumijem da je potrebno i uklanjanje starog predmeta"],
      },
    ],
  },

  // ─────────────────────────────────────────────
  // OUT OF SCOPE — ELEKTRO
  // ─────────────────────────────────────────────

  {
    name: "OOS elektro - nova elektro instalacija",
    steps: [
      {
        input: "Treba nova elektro instalacija u stanu.",
        expected: ["Žao nam je"],
        notExpected: ["manju elektro intervenciju"],
      },
    ],
  },
  {
    name: "OOS elektro - štemanje i kablovi",
    steps: [
      {
        input: "Treba štemanje zidova i provlačenje kablova.",
        expected: ["Žao nam je"],
        notExpected: ["manju elektro intervenciju"],
      },
    ],
  },
  {
    name: "OOS elektro - kompletna elektro instalacija",
    steps: [
      {
        input: "Renoviram stan i treba kompletna elektro instalacija.",
        expected: ["Žao nam je"],
        notExpected: ["manju elektro intervenciju"],
      },
    ],
  },
  {
    name: "OOS elektro - nova razvodna tabla",
    steps: [
      {
        input: "Treba nova razvodna tabla.",
        expected: ["Žao nam je"],
        notExpected: ["manju elektro intervenciju"],
      },
    ],
  },

  // ─────────────────────────────────────────────
  // OUT OF SCOPE — VODA
  // ─────────────────────────────────────────────

  {
    name: "OOS voda - kanalizacija u zidu",
    steps: [
      {
        input: "Začepljena kanalizacija u zidu.",
        expected: ["Žao nam je"],
        notExpected: ["manju vodoinstalatersku intervenciju"],
      },
    ],
  },
  {
    name: "OOS voda - pukla cijev u zidu",
    steps: [
      {
        input: "Pukla je vodovodna cijev u zidu.",
        expected: ["Žao nam je"],
        notExpected: ["manju vodoinstalatersku intervenciju"],
      },
    ],
  },
  {
    name: "OOS voda - nova vodovodna instalacija",
    steps: [
      {
        input: "Treba nova vodovodna instalacija.",
        expected: ["Žao nam je"],
        notExpected: ["manju vodoinstalatersku intervenciju"],
      },
    ],
  },
  {
    name: "OOS voda - začepljena odvodna cijev u zidu",
    steps: [
      {
        input: "Začepljena odvodna cijev u zidu.",
        expected: ["Žao nam je"],
        notExpected: ["manju vodoinstalatersku intervenciju"],
      },
    ],
  },
];

function request(path) {
  return new Promise((resolve, reject) => {
    http
      .get(`${BASE_URL}${path}`, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve(data));
      })
      .on("error", reject);
  });
}

function checkReply(reply, expected = [], notExpected = []) {
  const missing = expected.filter((text) => !reply.includes(text));
  const forbidden = notExpected.filter((text) => reply.includes(text));

  return {
    ok: missing.length === 0 && forbidden.length === 0,
    missing,
    forbidden,
  };
}

async function run() {
  let passed = 0;
  let failed = 0;

  for (let i = 0; i < tests.length; i++) {
    const test = tests[i];
    const userId = `kw-master-${i}-${Date.now()}`;

    await request(`/reset?userId=${encodeURIComponent(userId)}`);

    let testOk = true;
    const failDetails = [];

    for (let stepIndex = 0; stepIndex < test.steps.length; stepIndex++) {
      const step = test.steps[stepIndex];

      const reply = await request(
        `/next?userId=${encodeURIComponent(userId)}&tekst=${encodeURIComponent(
          step.input,
        )}`,
      );

      const result = checkReply(
        reply,
        step.expected || [],
        step.notExpected || [],
      );

      if (!result.ok) {
        testOk = false;
        failDetails.push({
          step: stepIndex + 1,
          input: step.input,
          reply,
          missing: result.missing,
          forbidden: result.forbidden,
        });
      }
    }

    if (testOk) {
      passed++;
      console.log(`✅ PASS: ${test.name}`);
    } else {
      failed++;
      console.log(`❌ FAIL: ${test.name}`);
      failDetails.forEach((detail) => {
        console.log(`Step: ${detail.step}`);
        console.log(`Input: ${detail.input}`);
        console.log(`Reply: ${detail.reply}`);
        if (detail.missing.length > 0) {
          console.log(`Missing expected: ${detail.missing.join(" | ")}`);
        }
        if (detail.forbidden.length > 0) {
          console.log(`Forbidden found: ${detail.forbidden.join(" | ")}`);
        }
      });
      console.log("");
    }
  }

  console.log("----------------");
  console.log(`Total: ${tests.length}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
}

run().catch((err) => {
  console.error("Test runner error:", err.message);
});
