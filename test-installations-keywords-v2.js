const http = require("http");

const BASE_URL = "http://localhost:3000";

const tests = [
  {
    name: "B1 - karnišle + uklanjanje starih",
    input: "Trebam postavljanje novih karnišli, a uklanjanje starih.",
    expected: ["montažu namještaja"],
    notExpected: ["Da li je prostor pripremljen", "O kojoj vrsti radova"],
  },
  {
    name: "B1 - viseća kuhinja + uklanjanje stare",
    input: "Trebam da mi postavite novu viseću kuhinju a uklonite staru.",
    expected: ["montažu namještaja"],
    notExpected: ["Da li je prostor pripremljen", "O kojoj vrsti radova"],
  },
  {
    name: "B1 - montaža viseće kuhinje + uklanjanje stare",
    input: "Trebam montažu viseće kuhinje, a uklanjanje stare.",
    expected: ["montažu namještaja"],
    notExpected: ["Da li je prostor pripremljen", "O kojoj vrsti radova"],
  },
  {
    name: "B1 - regal uklanjanje + montaža",
    input: "Trebam uklanjanje regala i montažu novog.",
    expected: ["montažu namještaja"],
    notExpected: ["Da li je prostor pripremljen"],
  },
  {
    name: "B1 - rastaviti stari regal i sastaviti novi",
    input: "Treba rastaviti stari regal i sastaviti novi.",
    expected: ["montažu namještaja"],
    notExpected: ["Da li je prostor pripremljen"],
  },
  {
    name: "DEVICES conflict - veš mašina izbacuje osigurač",
    input: "Kada na veš mašini stisnem dugme za paljenje, izbaci osigurač.",
    expected: ["problem sa veš mašinom", "brend"],
    notExpected: [
      "manju elektro intervenciju",
      "manju vodoinstalatersku intervenciju",
      "Da li već imate dio",
    ],
  },
  {
    name: "DEVICES conflict - mašina izbacuje osigurač",
    input: "Veš mašina izbacuje osigurač kad je uključim.",
    expected: ["problem sa veš mašinom", "brend"],
    notExpected: ["manju elektro intervenciju", "Da li već imate dio"],
  },
  {
    name: "B2 - osigurač kad upalim svjetlo",
    input: "Izbacuje osigurač kad upalim svjetlo.",
    expected: ["manju elektro intervenciju"],
    notExpected: ["problem sa", "vodoinstalatersku"],
  },
  {
    name: "B1 - kuhinjski elementi + uklanjanje starih",
    input: "Treba montaža kuhinjskih elemenata i uklanjanje starih.",
    expected: ["montažu namještaja"],
    notExpected: ["Da li je prostor pripremljen", "O kojoj vrsti radova"],
  },
  {
    name: "B1 - kuhinjski blok",
    input: "Treba montaža kuhinjskog bloka.",
    expected: ["montažu namještaja"],
    notExpected: ["O kojoj vrsti radova"],
  },
  {
    name: "B1 - postaviti viseće elemente",
    input: "Treba postaviti viseće elemente.",
    expected: ["montažu namještaja"],
    notExpected: ["O kojoj vrsti radova"],
  },
  {
    name: "B1 - garnišle + skidanje starih",
    input: "Treba postaviti garnišle i skinuti stare.",
    expected: ["montažu namještaja"],
    notExpected: ["Da li je prostor pripremljen"],
  },
  {
    name: "B1 - već uklonjen stari ormar",
    input: "Stari ormar je već uklonjen, treba montirati novi.",
    expected: ["montažu namještaja"],
    notExpected: ["Razumijem da je potrebno i uklanjanje starog predmeta"],
  },
  {
    name: "B3 - tuš kada realni predmet",
    input: "Treba zamijeniti tuš kadu.",
    expected: ["manju vodoinstalatersku intervenciju"],
    notExpected: ["problem sa veš mašinom"],
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

async function run() {
  let passed = 0;
  let failed = 0;

  for (let i = 0; i < tests.length; i++) {
    const test = tests[i];
    const userId = `kw-v2-${i}-${Date.now()}`;

    await request(`/reset?userId=${encodeURIComponent(userId)}`);

    const reply = await request(
      `/next?userId=${encodeURIComponent(userId)}&tekst=${encodeURIComponent(test.input)}`,
    );

    const okExpected = (test.expected || []).every((text) =>
      reply.includes(text),
    );

    const okNotExpected = (test.notExpected || []).every(
      (text) => !reply.includes(text),
    );

    const ok = okExpected && okNotExpected;

    if (ok) {
      passed++;
      console.log(`✅ PASS: ${test.name}`);
    } else {
      failed++;
      console.log(`❌ FAIL: ${test.name}`);
      console.log(`Input: ${test.input}`);
      console.log(`Reply: ${reply}`);
      console.log("");
    }
  }

  console.log("----------------");
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
}

run().catch((err) => {
  console.error("Test runner error:", err.message);
});
