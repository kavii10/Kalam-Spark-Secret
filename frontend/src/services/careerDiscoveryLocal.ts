export interface RiasecVector {
  R: number; // Realistic
  I: number; // Investigative
  A: number; // Artistic
  S: number; // Social
  E: number; // Enterprising
  C: number; // Conventional
}

export const FIELD_META: Record<string, { name: string; emoji: string; oneLiner: string; requiredSubjects: string[]; entranceExam: string }> = {
  applied_sciences: {
    name: "Pure & Applied Sciences",
    emoji: "🔬",
    oneLiner: "Your profound scientific curiosity is perfectly aligned with physics, astrophysics, chemical research, and space exploration.",
    requiredSubjects: ["Physics", "Chemistry", "Mathematics"],
    entranceExam: "University Entrance Exams / Science Aptitude Tests"
  },
  computer_science: {
    name: "Computer Science & AI",
    emoji: "💻",
    oneLiner: "Your logical mind is perfectly suited for software development, cybersecurity, and advanced AI systems.",
    requiredSubjects: ["Computer Science / IP", "Mathematics", "Physics"],
    entranceExam: "College Entrance Exams or direct university admissions"
  },
  engineering: {
    name: "Engineering & Tech",
    emoji: "⚙️",
    oneLiner: "You are a natural builder who enjoys working with machines, systems, propulsion, and structural designs.",
    requiredSubjects: ["Mathematics", "Physics", "Chemistry"],
    entranceExam: "Engineering / Science Entrance Exams"
  },
  healthcare: {
    name: "Healthcare & Medical Sciences",
    emoji: "🩺",
    oneLiner: "You are deeply drawn to healing, medical science, clinical diagnostics, and helping living systems.",
    requiredSubjects: ["Biology", "Chemistry", "Physics"],
    entranceExam: "Medical / Healthcare Entrance Exams (e.g. MCAT)"
  },
  psychology: {
    name: "Psychology & Human Behavior",
    emoji: "🧠",
    oneLiner: "You love exploring the human mind, behavior, therapy, child development, and clinical counseling systems.",
    requiredSubjects: ["Psychology", "Biology", "English"],
    entranceExam: "Psychology Program Entrance Exams / Admissions"
  },
  civil_services: {
    name: "Civil Services & Governance",
    emoji: "🏛️",
    oneLiner: "You are passionate about nation-building, administrative leadership, policy drafting, and national security.",
    requiredSubjects: ["Social Studies / Humanities", "Political Science", "Economics"],
    entranceExam: "Civil Service / Public Administration Exams"
  },
  design: {
    name: "Design & Creative Arts",
    emoji: "🎨",
    oneLiner: "You have an exceptional artistic eye for colors, layouts, animations, and physical product aesthetics.",
    requiredSubjects: ["English", "Any stream (Art/Design portfolio is key)"],
    entranceExam: "Art & Design Portfolio Evaluation"
  },
  law: {
    name: "Law & Legal Studies",
    emoji: "⚖️",
    oneLiner: "You have a powerful sense of justice, advocacy, public policy, and constitutional legal structures.",
    requiredSubjects: ["Social Studies / Humanities", "Legal Studies", "English"],
    entranceExam: "Law School Admission Tests (e.g. LSAT)"
  },
  business: {
    name: "Business & Management",
    emoji: "🚀",
    oneLiner: "You are a visionary leader who loves designing startup plans, leading teams, and managing operations.",
    requiredSubjects: ["Business Studies", "Accountancy", "Economics"],
    entranceExam: "Business School Entrance Exams / SAT"
  },
  finance: {
    name: "Finance & Economics",
    emoji: "📊",
    oneLiner: "You love analyzing numeric trends, wealth management, audits, and monetary structures.",
    requiredSubjects: ["Mathematics", "Economics", "Accountancy"],
    entranceExam: "Professional Accountancy & Finance Board Exams"
  },
  education: {
    name: "Education & Academic Mentoring",
    emoji: "🏫",
    oneLiner: "You are a patient mentor and counselor who derives immense joy from teaching and guiding others.",
    requiredSubjects: ["Psychology", "English", "Any specialization subject"],
    entranceExam: "Teacher Credential Exams / Education Entrance Exams"
  },
  agriculture: {
    name: "Agriculture & Earth Sciences",
    emoji: "🌱",
    oneLiner: "You are dedicated to nature, ecological conservation, animal rescue, and sustainable farming.",
    requiredSubjects: ["Biology", "Chemistry", "Agriculture science"],
    entranceExam: "Agricultural & Earth Sciences Entrance Exams"
  }
};

export const FALLBACK_CAREERS: Record<string, { title: string; emoji: string; why: string; exams: string; subs: string[] }[]> = {
  applied_sciences: [
    { title: "Astrophysicist & Space Scientist", emoji: "🌌", why: "Your fascination with outer space, planetary orbits, and physics fits perfectly with a research career at global space agencies like NASA or ESA.", exams: "Advanced Physics / Space Science Exams", subs: ["Physics", "Mathematics", "Chemistry"] },
    { title: "Quantum Physics Researcher", emoji: "⚛️", why: "Exploring the fundamental building blocks of matter, quantum computing, and solving deep molecular mysteries matches your high-level analytical capacity.", exams: "Science Aptitude Tests", subs: ["Physics", "Mathematics", "Chemistry"] },
    { title: "Computational Physicist", emoji: "💻", why: "Combining your love for scientific discovery and coding algorithms to build planetary climates or atomic simulations.", exams: "College Entrance Exams", subs: ["Physics", "Mathematics", "Computer Science"] },
    { title: "Nuclear Research Scientist", emoji: "🔬", why: "Your intense interest in clean atomic power, fusion reactors, and advanced lab experiments fits premium scientific career paths.", exams: "Graduate / Science Entrance Exams", subs: ["Physics", "Chemistry", "Mathematics"] },
    { title: "Experimental Nanotechnologist", emoji: "🧪", why: "Formulating microscopic semiconductors, high-efficiency superconductive materials, and nanotechnology structures.", exams: "College Entrance Exams", subs: ["Physics", "Chemistry", "Mathematics"] },
    { title: "Astronomical Instrument Engineer", emoji: "🔭", why: "Designing high-precision satellite optical mirrors, deep-space sensors, and telescope grids aligns your engineering skills with physics.", exams: "Engineering Physics Admissions / SAT", subs: ["Physics", "Mathematics", "Chemistry"] }
  ],
  computer_science: [
    { title: "AI / Machine Learning Engineer", emoji: "🤖", why: "Your deep interest in algorithms, neural networks, and Large Language Models makes you a prime candidate for cutting-edge AI development.", exams: "B.S. AI/CS Admissions / SAT", subs: ["Mathematics", "Computer Science", "Physics"] },
    { title: "Computer Vision Researcher", emoji: "👁️", why: "Creating spatial tracking models, autonomous drone navigations, and real-time scanning systems merges math with computer science.", exams: "College Entrance Exams", subs: ["Mathematics", "Computer Science", "Physics"] },
    { title: "Cybersecurity & Pen-Tester", emoji: "🛡️", why: "Guarding critical server frameworks, detecting firewalls weaknesses, and designing end-to-end encrypted networks.", exams: "Cybersecurity Certification / CS Admission", subs: ["Computer Science", "Mathematics", "English"] },
    { title: "Cloud Solutions Architect", emoji: "☁️", why: "Deploying highly scalable web structures and load balancers capable of serving millions of active daily users.", exams: "Computer Science Admissions / SAT", subs: ["Computer Science", "Mathematics"] },
    { title: "Game Engine Programmer", emoji: "🎮", why: "Writing real-time collision dynamics, lighting solvers, and hardware-accelerated physics engines inside custom game engines.", exams: "University CS Admissions", subs: ["Computer Science", "Mathematics", "Physics"] },
    { title: "UI/UX Technical Engineer", emoji: "🖥️", why: "Integrating beautiful, highly responsive client screens with fast cloud server endpoints to create seamless consumer web interfaces.", exams: "Portfolio / Design Admissions", subs: ["Computer Science", "English", "Any Stream"] }
  ],
  engineering: [
    { title: "Robotics & Automation Engineer", emoji: "🤖", why: "Designing micro-system electronic controllers, sensor feedback scripts, and robotic limb joints.", exams: "Engineering Entrance Exams", subs: ["Mathematics", "Physics", "Computer Science"] },
    { title: "Aerospace Propulsion Developer", emoji: "🚀", why: "Simulating rocket engine combustion, fuel thermodynamics, and satellite orbit trajectories.", exams: "Aerospace Science Admissions / SAT", subs: ["Mathematics", "Physics", "Chemistry"] },
    { title: "EV Powertrain Engineer", emoji: "⚡", why: "Building lithium battery cooling matrices, high-torque electric motors, and smart charging systems.", exams: "Engineering Entrance Exams", subs: ["Mathematics", "Physics", "Chemistry"] },
    { title: "Aeronautical Structure Designer", emoji: "✈️", why: "Modeling drag profiles, sonic wind resistance, and structural chassis safety of supersonic jets.", exams: "Engineering Entrance Exams", subs: ["Mathematics", "Physics", "Chemistry"] },
    { title: "Renewable Grid Systems Engineer", emoji: "☀️", why: "Configuring high-capacity clean solar banks, offshore wind dams, and sustainable hydrogen cells.", exams: "Engineering Entrance Exams", subs: ["Physics", "Mathematics", "Chemistry"] },
    { title: "Structural Bridge Architect", emoji: "🏗️", why: "Calculating cable tensions, load dynamics, and concrete tolerances for massive suspension flyovers.", exams: "Architecture Entrance Exam / NATA", subs: ["Mathematics", "Physics", "Chemistry"] }
  ],
  healthcare: [
    { title: "Cardiothoracic Surgeon", emoji: "🩺", why: "Performing delicate, critical-care surgeries and maintaining absolute composure under intense hospital pressures.", exams: "Medical School / Surgical Residency", subs: ["Biology", "Chemistry", "Physics"] },
    { title: "Neurologist / Brain Specialist", emoji: "🧠", why: "Diagnosing complex neural pathologies, mapping synaptic behavior, and tracking brain disorders.", exams: "Medical School / Residency", subs: ["Biology", "Chemistry", "Physics"] },
    { title: "Virologist & Drug Developer", emoji: "🔬", why: "Formulating therapeutic chemical molecules and engineering vaccines to halt regional disease outbreaks.", exams: "Medical School / Bio-Tech admissions", subs: ["Biology", "Chemistry", "Physics"] },
    { title: "Pediatric Care Specialist", emoji: "👶", why: "Providing clinical diagnostics and preventive immunizations for children with a gentle, patient-first demeanor.", exams: "Medical School / Pediatric Residency", subs: ["Biology", "Chemistry", "Physics"] },
    { title: "Radiological Diagnostics Specialist", emoji: "📸", why: "Operating advanced medical imaging scanners, MRIs, and ultrasounds to pinpoint hidden pathologies.", exams: "Medical Imaging Program entries", subs: ["Biology", "Chemistry", "Physics"] },
    { title: "Biomedical Equipment Designer", emoji: "🧬", why: "Creating advanced diagnostic chips, dialysis machines, and robotic prosthetics by merging engineering with medical sciences.", exams: "Biomedical Engineering entries", subs: ["Physics", "Chemistry", "Biology / Math"] }
  ],
  psychology: [
    { title: "Clinical Neuropsychologist", emoji: "🧠", why: "Studying how physical brain trauma, chemical imbalances, and neural pathways dictate cognitive human behaviors.", exams: "Psychology Admission + Masters + PhD", subs: ["Psychology", "Biology", "English"] },
    { title: "Child & School Counselor", emoji: "🏫", why: "Supporting children's cognitive development, diagnosing learning challenges, and mentoring youth through hurdles.", exams: "Psychology Program + Masters", subs: ["Psychology", "English", "Any Stream"] },
    { title: "Organizational Behavior Expert", emoji: "🏢", why: "Improving corporate workspaces, boosting productivity, and designing mental wellness policies inside high-stress workplaces.", exams: "Business Admissions + MBA", subs: ["Psychology", "English", "Business Studies"] },
    { title: "Sports Psychologist", emoji: "🏆", why: "Coaching top-tier professional athletes to master high-pressure focus, competitive stress, and team dynamics.", exams: "Sports Science Admissions", subs: ["Psychology", "Physical Education", "Biology"] },
    { title: "Rehabilitation Counselor", emoji: "🤝", why: "Helping patients recover and adapt to trauma, chronic illness, or physical challenges through mental resilience programs.", exams: "Counseling Program Admissions", subs: ["Psychology", "English", "Any Stream"] },
    { title: "Cognitive Science Researcher", emoji: "🧠", why: "Investigating memory, attention, language processing, and decision-making systems in academic lab settings.", exams: "Cognitive Science Admissions", subs: ["Psychology", "Mathematics", "Biology"] }
  ],
  civil_services: [
    { title: "Public Services Administrator", emoji: "🏛️", why: "Leading district development, enforcing public policy, coordinating disaster relief, and supervising regional municipal bodies.", exams: "Civil Service / Administrative Exams", subs: ["History", "Political Science", "Economics / Any Stream"] },
    { title: "Public Safety Officer", emoji: "👮", why: "Maintaining regional law and order, managing municipal police forces, and designing city safety systems.", exams: "Civil Service Exams", subs: ["Any Stream", "Physical Education"] },
    { title: "Diplomatic Ambassador", emoji: "🌍", why: "Representing your nation at international summits, drafting foreign trade deals, and managing bilateral embassies.", exams: "Foreign Service / Diplomatic Exams", subs: ["Political Science", "History", "English"] },
    { title: "Public Policy Consultant", emoji: "📋", why: "Advising government ministries and municipal agencies on infrastructure, healthcare, and economic guidelines.", exams: "Public Policy Admissions", subs: ["Economics", "Political Science", "English"] },
    { title: "Revenue Administrator", emoji: "📊", why: "Supervising national customs audits, tax compliance, and steering central financial policies.", exams: "Treasury / Tax Administrator Exams", subs: ["Economics", "Accountancy / Any Stream"] },
    { title: "Regional Executive Officer", emoji: "🏢", why: "Directing land revenue records, state welfare initiatives, and executing local infrastructure budgets.", exams: "Civil Service / Public Service Exams", subs: ["Any Stream", "Regional Language"] }
  ],
  design: [
    { title: "Automotive Industrial Designer", emoji: "🏎️", why: "Sketching futuristic automobile chassis, designing aerodynamically efficient outer surfaces, and selecting luxury cabin aesthetics.", exams: "Design Admissions / Portfolio", subs: ["Art / Design", "Physics", "English"] },
    { title: "UI/UX Experience Designer", emoji: "📱", why: "Mapping user screens, drawing high-fidelity web page wireframes, and optimizing interactive consumer applications.", exams: "Design Admissions / Portfolio", subs: ["Any Stream", "Computer Science"] },
    { title: "3D Animation & VFX Artist", emoji: "🎬", why: "Designing spatial virtual characters, modeling cinematic visual effects, and texture mapping for entertainment media.", exams: "Art & Design Admissions", subs: ["Any Stream", "Art"] },
    { title: "Architectural Space Designer", emoji: "🏡", why: "Drafting structural floor maps, styling internal room spaces, and combining natural light with organic wood/stone textures.", exams: "Architecture admissions / Portfolio", subs: ["Mathematics", "Art / Physics"] },
    { title: "Apparel & Fashion Designer", emoji: "👗", why: "Selecting luxury fabric weaves, drawing custom clothing patterns, and organizing high-profile national runway collections.", exams: "Fashion Design Admissions / Portfolio", subs: ["Any Stream", "Art"] },
    { title: "Graphic Brand Identity Specialist", emoji: "🏷️", why: "Creating unique brand logos, color palettes, and typography layouts for top corporate consumer products.", exams: "Art & Design Admissions", subs: ["Any Stream", "Art"] }
  ],
  law: [
    { title: "Supreme Court Litigator", emoji: "⚖️", why: "Presenting complex constitutional defense lines, arguing civil rights appeals, and protecting citizen liberties.", exams: "Law School Admissions (e.g. LSAT)", subs: ["Legal Studies", "Political Science", "English"] },
    { title: "Corporate Mergers Attorney", emoji: "💼", why: "Drafting high-value business contracts, resolving startup acquisitions, and guiding compliance filings.", exams: "Law School Admissions", subs: ["Business Studies", "Economics", "English"] },
    { title: "Cyber Law & Digital IP Counsel", emoji: "🔒", why: "Arbitrating software copyright infringements, digital piracy suits, and advising tech startups on privacy breaches.", exams: "Law School Admissions", subs: ["Computer Science", "Legal Studies", "English"] },
    { title: "Environmental Policy Counsel", emoji: "🌱", why: "Representing green conservation organizations in lawsuits against toxic factory emissions and defending forest bio-reserves.", exams: "Law School Admissions", subs: ["Legal Studies", "Biology / Geography"] },
    { title: "International Arbitration Lawyer", emoji: "🌍", why: "Representing domestic enterprises in multinational trade tribunals and resolving border commercial clashes.", exams: "Law School Admissions (LSAT)", subs: ["Political Science", "Legal Studies", "English"] },
    { title: "Judicial Magistrate", emoji: "👨‍⚖️", why: "Evaluating regional trial evidence, validating legal warrants, and presiding over municipal court proceedings.", exams: "Judicial Service Exams", subs: ["Legal Studies", "Political Science", "English"] }
  ],
  business: [
    { title: "Venture-Backed Founder", emoji: "🚀", why: "Launching high-growth tech startups, formulating pitch decks, and raising seed venture capital.", exams: "Business School Admissions", subs: ["Business Studies", "Economics", "English"] },
    { title: "Global Operations Manager", emoji: "🏢", why: "Optimizing international manufacturing chains, cutting shipping delays, and managing regional product branches.", exams: "Management Admissions (e.g. GMAT / SAT)", subs: ["Business Studies", "Mathematics", "English"] },
    { title: "Product Growth Director", emoji: "📈", why: "Analyzing consumer market trends, coordinating engineering cycles, and managing high-scale advertising budgets.", exams: "Management / Business Admissions", subs: ["Business Studies", "Economics", "English"] },
    { title: "Strategy Consultant", emoji: "👔", why: "Advising Fortune 500 companies on cost restructuring, product expansion tracks, and corporate governance.", exams: "Management Admissions (e.g. GMAT / SAT)", subs: ["Economics", "Mathematics", "Business Studies"] },
    { title: "Franchise Operations Director", emoji: "🏬", why: "Expanding retail brand outlets, managing partner contracts, and standardizing quality control models.", exams: "Business Admissions", subs: ["Business Studies", "Accountancy"] },
    { title: "Human Capital Director", emoji: "🤝", why: "Designing employee hiring programs, running professional workshops, and optimizing workplace culture.", exams: "Business Admissions", subs: ["Business Studies", "Psychology", "English"] }
  ],
  finance: [
    { title: "Investment Banker", emoji: "📈", why: "Structuring mega-corporate share listings (IPOs), orchestrating high-value business sales, and building financial spreadsheets.", exams: "Economics Admissions (e.g. SAT / GRE)", subs: ["Mathematics", "Economics", "Accountancy"] },
    { title: "Chartered Accountant (CA)", emoji: "📊", why: "Managing high-scale corporate tax filings, leading federal financial audits, and protecting client balance sheets.", exams: "Chartered Accountancy Board entries", subs: ["Accountancy", "Mathematics", "Economics"] },
    { title: "Quantitative Fund Analyst", emoji: "🖥️", why: "Writing computer programs to auto-trade stock fluctuations, hedge derivative risks, and calculate market risks.", exams: "Quantitative / Math Admissions", subs: ["Mathematics", "Computer Science", "Economics"] },
    { title: "Portfolio Wealth Manager", emoji: "💰", why: "Customizing mutual fund collections, real estate indices, and tax-saving assets for high-net-worth clients.", exams: "Finance Program Admissions", subs: ["Accountancy", "Economics", "Mathematics"] },
    { title: "Corporate Treasury Controller", emoji: "🏦", why: "Managing company cash flows, optimizing loan interests, and guiding quarterly currency hedges.", exams: "Finance Admissions", subs: ["Accountancy", "Economics"] },
    { title: "Actuarial Risk Scientist", emoji: "🎲", why: "Utilizing complex probability math to calculate insurance policies, pension payouts, and credit default ratios.", exams: "Actuarial Board Exams / SAT Math", subs: ["Mathematics", "Economics"] }
  ],
  education: [
    { title: "High School Master Teacher", emoji: "🏫", why: "Teaching advanced science or humanities subjects, designing digital lesson files, and mentoring youth toward success.", exams: "Teacher Credential Program / University Admissions", subs: ["Specialized Subject", "English"] },
    { title: "Curriculum Design Specialist", emoji: "📚", why: "Drafting innovative national school syllabus guidelines, student activity manuals, and interactive board games.", exams: "Education Program Admissions", subs: ["Psychology", "English", "Any Stream"] },
    { title: "Educational Tech Founder", emoji: "💻", why: "Building online visual classrooms, live teaching applications, and interactive revision dashboards.", exams: "EdTech Admissions", subs: ["Computer Science", "English", "Any Stream"] },
    { title: "Special Education Counselor", emoji: "🤝", why: "Coaching neurodivergent students using custom tactile models, behavioral maps, and physical therapies.", exams: "Special Education Certification", subs: ["Psychology", "English"] },
    { title: "University Research Professor", emoji: "🎓", why: "Conducting original scholarly research studies, publishing lab journals, and delivering college lectures.", exams: "University Faculty Qualifications", subs: ["Specialized Subject"] },
    { title: "Advanced Prep Coach", emoji: "✏️", why: "Coaching premier candidates for competitive college exams with advanced problem-solving strategies.", exams: "Subject Specialization admissions", subs: ["Specialized Subject"] }
  ],
  agriculture: [
    { title: "Agrotech Drone Systems Specialist", emoji: "🌾", why: "Utilizing multispectral flying cameras to check soil nitrogen ratios and programming automated crop watering grids.", exams: "Agricultural Engineering Admissions", subs: ["Physics", "Mathematics", "Agriculture"] },
    { title: "Horticulture Biologist", emoji: "🌱", why: "Breeding resilient cross-crop plants, optimizing organic greenhouse fruit yields, and defending against pests.", exams: "Agricultural Science admissions", subs: ["Biology", "Chemistry", "Agriculture"] },
    { title: "Organic Farm Systems Designer", emoji: "🚜", why: "Designing sustainable natural fertilizer cycles, drip-irrigation layouts, and zero-chemical dairy grids.", exams: "Agriculture admissions", subs: ["Biology", "Agriculture"] },
    { title: "Wildlife Conservation Officer", emoji: "🐅", why: "Tracking regional forest populations, managing biosphere reserve boundaries, and protecting vulnerable ecosystems.", exams: "Forestry Board / Civil Service Exams", subs: ["Biology", "Chemistry", "Geography"] },
    { title: "Marine Ecosystems Biologist", emoji: "🐠", why: "Monitoring ocean coral reefs, managing sustainable shrimp aquaculture pools, and treating water impurities.", exams: "Marine Biology admissions", subs: ["Biology", "Chemistry", "Geography"] },
    { title: "Soil Chemistry Researcher", emoji: "🧪", why: "Analyzing regional soil mineral depleting patterns and formulating custom bio-fertilizers to boost multi-crop harvests.", exams: "Soil Chemistry Admissions", subs: ["Chemistry", "Biology", "Agriculture"] }
  ]
};

export function calculateRiasecVector(studentClass: string, studentStream: string, quickFacts: any, messages: any[]): RiasecVector {
  const vector: RiasecVector = { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 };

  // 1. Favorite Subject Mapping
  const fav = (quickFacts?.favouriteSubject || "").toLowerCase();
  if (/physics|chemistry|mechanic|aviation|space|agriculture/i.test(fav)) vector.R += 3;
  if (/biology|science|research|math|calculus|computer|psychology/i.test(fav)) vector.I += 3;
  if (/art|design|english|language|writing/i.test(fav)) vector.A += 3;
  if (/psychology|social|civics|history/i.test(fav)) vector.S += 3;
  if (/business|economics|politics|governance/i.test(fav)) vector.E += 3;
  if (/accountancy|math|finance/i.test(fav)) vector.C += 3;

  // 2. Easiest Subject Mapping
  const easy = (quickFacts?.easiestSubject || "").toLowerCase();
  if (/physics|chemistry|mechanic|aviation|space|agriculture/i.test(easy)) vector.R += 2;
  if (/biology|science|research|math|calculus|computer|psychology/i.test(easy)) vector.I += 2;
  if (/art|design|english|language|writing/i.test(easy)) vector.A += 2;
  if (/psychology|social|civics|history/i.test(easy)) vector.S += 2;
  if (/business|economics|politics|governance/i.test(easy)) vector.E += 2;
  if (/accountancy|math|finance/i.test(easy)) vector.C += 2;

  // 3. Hardest Subject Penalty
  const hard = (quickFacts?.hardestSubject || "").toLowerCase();
  if (/physics|chemistry|mechanic|aviation|space|agriculture/i.test(hard)) vector.R -= 1;
  if (/biology|science|research|math|calculus|computer|psychology/i.test(hard)) vector.I -= 1;
  if (/art|design|english|language|writing/i.test(hard)) vector.A -= 1;
  if (/psychology|social|civics|history/i.test(hard)) vector.S -= 1;
  if (/business|economics|politics|governance/i.test(hard)) vector.E -= 1;
  if (/accountancy|math|finance/i.test(hard)) vector.C -= 1;

  // 4. Stated Interests Mapping
  const interests = quickFacts?.interests || quickFacts?.dislikes || [];
  interests.forEach((interest: string) => {
    const iLower = interest.toLowerCase();
    if (/technology|coding|engineering|machines|robots|space|aviation|agriculture|environment/i.test(iLower)) {
      vector.R += 4;
    }
    if (/science|research|technology|coding|healthcare|medicine|psychology/i.test(iLower)) {
      vector.I += 4;
    }
    if (/design|art|creative|media|communication|music|performance/i.test(iLower)) {
      vector.A += 4;
    }
    if (/education|teaching|healthcare|medicine|psychology|social work|helping/i.test(iLower)) {
      vector.S += 4;
    }
    if (/business|management|law|policy|civil services|governance/i.test(iLower)) {
      vector.E += 4;
    }
    if (/finance|accounts|business/i.test(iLower)) {
      vector.C += 4;
    }
  });

  // 5. Chat History Keyword Scanner
  const rKeywords = /build|machines?|outdoors?|repair|hands-on|robots?|hardware|aviation|aerospace|plants?/i;
  const iKeywords = /research|analyz[ee]|discover|solve|math|programming|coding|science|clinical|investigat[ee]|logic/i;
  const aKeywords = /design|art|creative|styles?|draw|sketch|fashion|write|movie|brand|visual|aesthetic/i;
  const sKeywords = /teach|help|counsel|social|service|people|child|support|community|mentor/i;
  const eKeywords = /business|start|company|lead|manage|law|government|startup|venture|diplomat|policy|strategy/i;
  const cKeywords = /finance|audit|accounts?|spreadsheet|organize|tax|budget|data|report|compliance/i;

  let rMatches = 0, iMatches = 0, aMatches = 0, sMatches = 0, eMatches = 0, cMatches = 0;

  messages.forEach((m: any, idx: number) => {
    if (m.role === "user") {
      const text = m.text.toLowerCase();
      const prevModelMsg = (messages && idx > 0 && messages[idx - 1] && messages[idx - 1].role === "model") ? messages[idx - 1].text : "";
      if (/boring|avoid/i.test(prevModelMsg)) {
        return;
      }
      if (rKeywords.test(text)) rMatches++;
      if (iKeywords.test(text)) iMatches++;
      if (aKeywords.test(text)) aMatches++;
      if (sKeywords.test(text)) sMatches++;
      if (eKeywords.test(text)) eMatches++;
      if (cKeywords.test(text)) cMatches++;
    }
  });

  vector.R += Math.min(5, rMatches);
  vector.I += Math.min(5, iMatches);
  vector.A += Math.min(5, aMatches);
  vector.S += Math.min(5, sMatches);
  vector.E += Math.min(5, eMatches);
  vector.C += Math.min(5, cMatches);

  return vector;
}

export function getHollandProfileString(vector: RiasecVector): string {
  const mapping: { key: keyof RiasecVector; label: string }[] = [
    { key: "R", label: "Realistic" },
    { key: "I", label: "Investigative" },
    { key: "A", label: "Artistic" },
    { key: "S", label: "Social" },
    { key: "E", label: "Enterprising" },
    { key: "C", label: "Conventional" }
  ];
  const sorted = [...mapping].sort((a, b) => vector[b.key] - vector[a.key]);
  return sorted.slice(0, 3).map(x => x.key).join("");
}

export function generateChatLocalFallback(
  studentName: string,
  studentClass: string,
  studentStream: string,
  quickFacts: any,
  messages: any[]
): any {
  const scores: Record<string, number> = {
    applied_sciences: 0,
    computer_science: 0,
    engineering: 0,
    healthcare: 0,
    psychology: 0,
    civil_services: 0,
    design: 0,
    law: 0,
    business: 0,
    finance: 0,
    education: 0,
    agriculture: 0
  };

  // 1. Stated Favorite Subject (major boost of +10)
  const favSub = (quickFacts?.favouriteSubject || "").toLowerCase();
  if (favSub.includes("phys") || favSub.includes("space") || favSub.includes("astron")) {
    scores.applied_sciences += 10;
    scores.engineering += 5;
  } else if (favSub.includes("math") || favSub.includes("calc")) {
    scores.engineering += 8;
    scores.computer_science += 10;
    scores.finance += 5;
  } else if (favSub.includes("bio") || favSub.includes("zoology") || favSub.includes("botany")) {
    scores.healthcare += 10;
    scores.agriculture += 5;
  } else if (favSub.includes("chem")) {
    scores.applied_sciences += 8;
    scores.healthcare += 5;
  } else if (favSub.includes("psych") || favSub.includes("mind") || favSub.includes("behavi")) {
    scores.psychology += 10;
    scores.education += 5;
  } else if (favSub.includes("art") || favSub.includes("design") || favSub.includes("draw")) {
    scores.design += 10;
  } else if (favSub.includes("history") || favSub.includes("civics") || favSub.includes("pol") || favSub.includes("social")) {
    scores.civil_services += 10;
    scores.law += 5;
  } else if (favSub.includes("bus") || favSub.includes("comm") || favSub.includes("acc") || favSub.includes("econ")) {
    scores.business += 10;
    scores.finance += 10;
  } else if (favSub.includes("geo") || favSub.includes("env") || favSub.includes("agri")) {
    scores.agriculture += 10;
  }

  // 2. Hardest Subject Penalty (penalty of -5)
  const hardSub = (quickFacts?.hardestSubject || "").toLowerCase();
  if (hardSub.includes("phys") || hardSub.includes("space")) {
    scores.applied_sciences -= 5;
    scores.engineering -= 3;
  } else if (hardSub.includes("math") || hardSub.includes("calc")) {
    scores.engineering -= 5;
    scores.computer_science -= 5;
    scores.finance -= 5;
  } else if (hardSub.includes("bio") || hardSub.includes("zoology")) {
    scores.healthcare -= 5;
    scores.agriculture -= 3;
  } else if (hardSub.includes("chem")) {
    scores.applied_sciences -= 3;
  }

  // 3. Interests Boost (major positive constraint boost of +30)
  const interestsList = quickFacts?.interests || quickFacts?.dislikes || [];
  interestsList.forEach((interest: string) => {
    const iLower = interest.toLowerCase();
    
    // Technology & Coding
    if (iLower.includes("technology") || iLower.includes("coding") || iLower.includes("computer") || iLower.includes("software")) {
      scores.computer_science += 30;
      scores.engineering += 10;
    }
    // Science & Research
    if (iLower.includes("science") || iLower.includes("research") || iLower.includes("laboratory") || iLower.includes("chemistry") || iLower.includes("physics")) {
      scores.applied_sciences += 30;
      scores.healthcare += 10;
    }
    // Art & Design
    if (iLower.includes("art") || iLower.includes("design") || iLower.includes("drawing") || iLower.includes("graphics") || iLower.includes("creative")) {
      scores.design += 30;
    }
    // Business & Finance
    if (iLower.includes("business") || iLower.includes("finance") || iLower.includes("economics") || iLower.includes("marketing") || iLower.includes("money") || iLower.includes("management")) {
      scores.business += 30;
      scores.finance += 25;
    }
    // Healthcare & Medicine
    if (iLower.includes("health") || iLower.includes("medicine") || iLower.includes("hospital") || iLower.includes("doctor") || iLower.includes("clinical")) {
      scores.healthcare += 30;
      scores.psychology += 10;
    }
    // Engineering
    if (iLower.includes("engineering") || iLower.includes("mechanical") || iLower.includes("electrical") || iLower.includes("robots") || iLower.includes("machines")) {
      scores.engineering += 30;
      scores.computer_science += 10;
    }
    // Media & Communication
    if (iLower.includes("media") || iLower.includes("communication") || iLower.includes("journalism") || iLower.includes("writing") || iLower.includes("public speaking")) {
      scores.design += 15;
      scores.business += 15;
      scores.law += 10;
    }
    // Law & Justice
    if (iLower.includes("law") || iLower.includes("justice") || iLower.includes("advocate") || iLower.includes("court") || iLower.includes("legal")) {
      scores.law += 30;
      scores.civil_services += 15;
    }
    // Teaching & Education
    if (iLower.includes("teach") || iLower.includes("education") || iLower.includes("school") || iLower.includes("academy") || iLower.includes("professor")) {
      scores.education += 30;
      scores.psychology += 10;
    }
    // Music & Performance
    if (iLower.includes("music") || iLower.includes("perform") || iLower.includes("drama") || iLower.includes("singing") || iLower.includes("acting")) {
      scores.design += 25;
    }
    // Social Work & NGOs
    if (iLower.includes("social work") || iLower.includes("ngo") || iLower.includes("community") || iLower.includes("helping") || iLower.includes("public service")) {
      scores.civil_services += 25;
      scores.education += 15;
    }
    // Space & Aviation
    if (iLower.includes("space") || iLower.includes("aviation") || iLower.includes("aerospace") || iLower.includes("rocket") || iLower.includes("astronomy")) {
      scores.applied_sciences += 30;
      scores.engineering += 20;
    }
    // Agriculture & Earth Sciences
    if (iLower.includes("nature") || iLower.includes("animal") || iLower.includes("pet") || iLower.includes("farm") || iLower.includes("agri") || iLower.includes("forest") || iLower.includes("eco")) {
      scores.agriculture += 30;
    }
    
    // Parse "Other Area" custom inputs
    if (iLower.startsWith("other:")) {
      const customValue = iLower.replace("other:", "").trim();
      if (/code|tech|computer|software|web|app|program/i.test(customValue)) {
        scores.computer_science += 30;
        scores.engineering += 10;
      }
      if (/health|medicine|doctor|hospital|nurse|pharmacy/i.test(customValue)) {
        scores.healthcare += 30;
      }
      if (/art|design|paint|draw|photo|craft|creative/i.test(customValue)) {
        scores.design += 30;
      }
      if (/science|research|physics|chem|biology|lab|math/i.test(customValue)) {
        scores.applied_sciences += 25;
      }
      if (/business|finance|econ|marketing|trade|commerce/i.test(customValue)) {
        scores.business += 25;
        scores.finance += 25;
      }
      if (/law|legal|court|justice|police/i.test(customValue)) {
        scores.law += 30;
      }
      if (/teach|education|school|learn/i.test(customValue)) {
        scores.education += 30;
      }
      if (/space|aviation|rocket|aero|pilot|plane/i.test(customValue)) {
        scores.applied_sciences += 30;
        scores.engineering += 15;
      }
      if (/farm|agriculture|plants|wildlife|conservation|nature|forest|ecology|green|animal|pet/i.test(customValue)) {
        scores.agriculture += 30;
      }
    }
  });

  // 4. Subject Stream Constraints (Class 11/12 Alignment)
  const gradeVal = parseInt(studentClass);
  if ((gradeVal === 11 || gradeVal === 12) && studentStream) {
    const stream = studentStream.toLowerCase();
    if (stream.includes("pcm") && !stream.includes("b")) { // PCM only
      scores.engineering += 15;
      scores.computer_science += 15;
      scores.applied_sciences += 15;
      scores.healthcare -= 50; // No Biology
    } else if (stream.includes("pcb") && !stream.includes("m")) { // PCB only
      scores.healthcare += 15;
      scores.agriculture += 15;
      scores.psychology += 10;
      scores.engineering -= 50; // No Maths
    } else if (stream.includes("pcmb")) { // PCMB (both science fields)
      scores.engineering += 10;
      scores.computer_science += 10;
      scores.applied_sciences += 10;
      scores.healthcare += 10;
      scores.agriculture += 10;
    } else if (stream.includes("commerce")) {
      scores.finance += 15;
      scores.business += 15;
      scores.law += 10;
      scores.engineering -= 50;
      scores.healthcare -= 50;
      scores.applied_sciences -= 50;
      scores.computer_science -= 50;
    } else if (stream.includes("arts") || stream.includes("humanities")) {
      scores.psychology += 15;
      scores.civil_services += 15;
      scores.law += 15;
      scores.design += 15;
      scores.education += 10;
      scores.engineering -= 50;
      scores.healthcare -= 50;
      scores.applied_sciences -= 50;
      scores.computer_science -= 50;
      scores.finance -= 30;
    }
  }

  // Pre-defined weights for exact or partial option strings to prevent fuzzy keyword confusion
  const optionWeights = [
    { text: "tech, coding", fields: [{ field: "computer_science", weight: 6 }] },
    { text: "art, designing", fields: [{ field: "design", weight: 6 }] },
    { text: "nature, pet care", fields: [{ field: "agriculture", weight: 6 }] },
    { text: "money saving", fields: [{ field: "finance", weight: 4 }, { field: "business", weight: 4 }] },
    { text: "debating, public speaking", fields: [{ field: "law", weight: 4 }, { field: "civil_services", weight: 4 }] },
    { text: "helping, tutoring", fields: [{ field: "education", weight: 4 }, { field: "psychology", weight: 4 }] },
    
    { text: "practical lab/hands-on", fields: [{ field: "applied_sciences", weight: 6 }, { field: "healthcare", weight: 2 }] },
    { text: "analyzing facts, data", fields: [{ field: "finance", weight: 5 }, { field: "business", weight: 3 }] },
    { text: "creative, visual", fields: [{ field: "design", weight: 6 }] },
    { text: "understanding human stories", fields: [{ field: "psychology", weight: 4 }, { field: "law", weight: 4 }, { field: "civil_services", weight: 2 }] },
    
    { text: "mobile app, website", fields: [{ field: "computer_science", weight: 6 }] },
    { text: "physical working robot", fields: [{ field: "engineering", weight: 6 }, { field: "applied_sciences", weight: 3 }] },
    { text: "mockup startup plan", fields: [{ field: "business", weight: 6 }, { field: "finance", weight: 3 }] },
    { text: "creative short film", fields: [{ field: "design", weight: 6 }] },
    { text: "mock youth parliament", fields: [{ field: "law", weight: 4 }, { field: "civil_services", weight: 4 }, { field: "education", weight: 2 }] },
    { text: "eco-garden model", fields: [{ field: "agriculture", weight: 6 }] },
    
    { text: "scoring well in a tough test", fields: [{ field: "applied_sciences", weight: 5 }] },
    { text: "fixing or building a physical", fields: [{ field: "engineering", weight: 6 }] },
    { text: "patiently teaching or counseling", fields: [{ field: "education", weight: 5 }, { field: "psychology", weight: 4 }] },
    { text: "creating an artistic masterpiece", fields: [{ field: "design", weight: 6 }] },
    { text: "organizing a successful school", fields: [{ field: "business", weight: 5 }, { field: "finance", weight: 3 }] },
    { text: "standing up for someone", fields: [{ field: "law", weight: 5 }, { field: "civil_services", weight: 4 }] },
    
    { text: "search online", fields: [{ field: "computer_science", weight: 3 }, { field: "applied_sciences", weight: 2 }] },
    { text: "experimenting", fields: [{ field: "applied_sciences", weight: 6 }, { field: "engineering", weight: 3 }] },
    { text: "think deeply", fields: [{ field: "applied_sciences", weight: 5 }, { field: "computer_science", weight: 3 }] },
    { text: "ask a parent", fields: [{ field: "education", weight: 2 }, { field: "psychology", weight: 2 }] },
    
    { text: "climate change, animal welfare", fields: [{ field: "agriculture", weight: 6 }] },
    { text: "eradicating diseases & building", fields: [{ field: "healthcare", weight: 6 }] },
    { text: "building futuristic technology", fields: [{ field: "computer_science", weight: 6 }] },
    { text: "making education free", fields: [{ field: "education", weight: 6 }] },
    { text: "enforcing strict justice", fields: [{ field: "law", weight: 5 }, { field: "civil_services", weight: 5 }] },
    { text: "driving economic growth", fields: [{ field: "business", weight: 5 }, { field: "finance", weight: 5 }] },
    
    { text: "hands-on practical", fields: [{ field: "engineering", weight: 4 }, { field: "applied_sciences", weight: 2 }] },
    { text: "conceptual thinking", fields: [{ field: "applied_sciences", weight: 6 }, { field: "psychology", weight: 3 }] },
    
    { text: "leader coordinating", fields: [{ field: "business", weight: 5 }, { field: "civil_services", weight: 4 }] },
    { text: "doing the core work", fields: [{ field: "computer_science", weight: 3 }, { field: "engineering", weight: 3 }] },
    { text: "creative ideator", fields: [{ field: "design", weight: 5 }, { field: "business", weight: 2 }] },
    { text: "peacekeeper", fields: [{ field: "psychology", weight: 5 }, { field: "education", weight: 2 }] },
    
    { text: "coding, building software", fields: [{ field: "computer_science", weight: 6 }] },
    { text: "styling interfaces, digital", fields: [{ field: "design", weight: 6 }] },
    { text: "analyzing financial market", fields: [{ field: "finance", weight: 6 }, { field: "business", weight: 3 }] },
    { text: "non-tech human-centric", fields: [{ field: "healthcare", weight: 3 }, { field: "psychology", weight: 3 }, { field: "education", weight: 3 }] },
    { text: "drafting regulations, laws", fields: [{ field: "law", weight: 5 }, { field: "civil_services", weight: 5 }] },
    
    { text: "kalam (for leadership", fields: [{ field: "civil_services", weight: 6 }, { field: "applied_sciences", weight: 3 }] },
    { text: "da vinci (for ultimate", fields: [{ field: "design", weight: 5 }, { field: "engineering", weight: 4 }] },
    { text: "freud / chanakya", fields: [{ field: "psychology", weight: 6 }, { field: "education", weight: 3 }] },
    { text: "jobs / warren", fields: [{ field: "business", weight: 6 }, { field: "finance", weight: 4 }] },
    { text: "ambedkar (for fighting", fields: [{ field: "law", weight: 6 }, { field: "civil_services", weight: 2 }] },
    
    { text: "high-tech software office", fields: [{ field: "computer_science", weight: 6 }, { field: "engineering", weight: 3 }] },
    { text: "medical clinic, hospital", fields: [{ field: "healthcare", weight: 6 }, { field: "psychology", weight: 3 }] },
    { text: "creative design studio", fields: [{ field: "design", weight: 6 }] },
    { text: "outdoor farm, conservation", fields: [{ field: "agriculture", weight: 6 }] },
    { text: "courtroom, government", fields: [{ field: "law", weight: 5 }, { field: "civil_services", weight: 5 }, { field: "business", weight: 3 }] },
    { text: "school, coaching center", fields: [{ field: "education", weight: 6 }] },
    
    { text: "stable job with", fields: [{ field: "civil_services", weight: 4 }, { field: "finance", weight: 3 }] },
    { text: "startup with high", fields: [{ field: "business", weight: 5 }, { field: "computer_science", weight: 3 }] },
    
    { text: "saving lives, curing", fields: [{ field: "healthcare", weight: 6 }, { field: "psychology", weight: 3 }] },
    { text: "coding software used", fields: [{ field: "computer_science", weight: 6 }] },
    { text: "designing green machines", fields: [{ field: "engineering", weight: 6 }, { field: "design", weight: 3 }] },
    { text: "leading a successful", fields: [{ field: "business", weight: 6 }, { field: "finance", weight: 4 }] },
    { text: "ensuring public justice", fields: [{ field: "law", weight: 5 }, { field: "civil_services", weight: 5 }] },
    { text: "sharing deep knowledge", fields: [{ field: "education", weight: 6 }, { field: "agriculture", weight: 3 }] }
  ];

  messages.forEach((m, idx) => {
    if (m.role === "user") {
      const textVal = m.text.toLowerCase();

      const prevModelMsg = (messages && idx > 0 && messages[idx - 1] && messages[idx - 1].role === "model") ? messages[idx - 1].text : "";
      const isBoringQuestion = /boring|avoid/i.test(prevModelMsg);

      if (isBoringQuestion) {
        if (textVal.includes("🩺") || textVal.includes("🏥") || textVal.includes("🧬") || textVal.includes("hospital") || textVal.includes("clinic")) {
          scores.healthcare -= 25;
        }
        if (textVal.includes("💻") || textVal.includes("🤖") || textVal.includes("coding") || textVal.includes("screen")) {
          scores.computer_science -= 25;
        }
        if (textVal.includes("📊") || textVal.includes("💰") || textVal.includes("math")) {
          scores.finance -= 25;
        }
        if (textVal.includes("📢") || textVal.includes("⚖️") || textVal.includes("speaking") || textVal.includes("arguing")) {
          scores.law -= 25;
          scores.civil_services -= 25;
        }
        if (textVal.includes("🚜") || textVal.includes("🌱") || textVal.includes("outdoor") || textVal.includes("heat")) {
          scores.agriculture -= 25;
        }
        if (textVal.includes("📝") || textVal.includes("paperwork") || textVal.includes("government")) {
          scores.civil_services -= 25;
        }
        return;
      }
      
      let matchedEmoji = false;
      if (textVal.includes("🔬") || textVal.includes("⚛️") || textVal.includes("🌌") || textVal.includes("🔭") || textVal.includes("🧪")) {
        scores.applied_sciences += 6;
        matchedEmoji = true;
      }
      if (textVal.includes("💻") || textVal.includes("🤖") || textVal.includes("👾")) {
        scores.computer_science += 6;
        matchedEmoji = true;
      }
      if (textVal.includes("⚙️") || textVal.includes("🏗️") || textVal.includes("⚡") || textVal.includes("✈️")) {
        scores.engineering += 6;
        matchedEmoji = true;
      }
      if (textVal.includes("🩺") || textVal.includes("🏥") || textVal.includes("🧬")) {
        scores.healthcare += 6;
        matchedEmoji = true;
      }
      if (textVal.includes("🧠") || textVal.includes("👤") || textVal.includes("👥")) {
        scores.psychology += 6;
        matchedEmoji = true;
      }
      if (textVal.includes("🏛️") || textVal.includes("👮") || textVal.includes("🌍")) {
        scores.civil_services += 6;
        matchedEmoji = true;
      }
      if (textVal.includes("🎨") || textVal.includes("🎬") || textVal.includes("👗") || textVal.includes("📐") || textVal.includes("📸")) {
        scores.design += 6;
        matchedEmoji = true;
      }
      if (textVal.includes("⚖️")) {
        if (textVal.includes("parliament") || textVal.includes("debating")) {
          scores.civil_services += 5;
          scores.law += 3;
        } else {
          scores.law += 6;
        }
        matchedEmoji = true;
      }
      if (textVal.includes("🚀") || textVal.includes("🏢") || (textVal.includes("📈") && textVal.includes("startup"))) {
        scores.business += 6;
        matchedEmoji = true;
      }
      if (textVal.includes("📊") || (textVal.includes("📈") && !textVal.includes("startup")) || textVal.includes("💰") || textVal.includes("💵")) {
        scores.finance += 6;
        matchedEmoji = true;
      }
      if (textVal.includes("🏫") || textVal.includes("📚") || textVal.includes("✏️")) {
        scores.education += 6;
        matchedEmoji = true;
      }
      if (textVal.includes("🌱") || textVal.includes("🌾") || textVal.includes("🚜") || textVal.includes("🐅") || textVal.includes("🐠") || textVal.includes("🌳")) {
        scores.agriculture += 6;
        matchedEmoji = true;
      }

      // Check text weights
      optionWeights.forEach(ow => {
        if (textVal.includes(ow.text.toLowerCase())) {
          ow.fields.forEach(f => {
            scores[f.field] += f.weight;
          });
        }
      });

      if (!matchedEmoji) {
        if (/physics|physicist|science|space|cosmos|astrophysics|laboratory|research|experiment|einstein|quantum|atomic|nuclear|star|astro|telescope/i.test(textVal)) {
          scores.applied_sciences += 5;
        }
        if (/computer|code|coding|software|programmer|ai|artificial intelligence|machine learning|algorithm|cyber|hack|developer/i.test(textVal)) {
          scores.computer_science += 5;
        }
        if (/engineer|robot|machine|device|build|vehicle|damper|bridge|structures|torque|combustion|propulsion/i.test(textVal)) {
          scores.engineering += 5;
        }
        if (/doctor|medical|hospital|medicine|clinic|surgery|disease|biological|anatomy|pediatric|heart/i.test(textVal)) {
          scores.healthcare += 5;
        }
        if (/psychology|psychologist|mind|behavior|brain|counselor|mental|therapy|behavioral/i.test(textVal)) {
          scores.psychology += 5;
        }
        if (/ias|civil|upsc|governance|administrator|policy|diplomat|collector|police|ips|ifs|diplomatic|summit/i.test(textVal)) {
          scores.civil_services += 5;
        }
        if (/design|art|creative|painting|drawing|video|sketch|aesthetic|illustration|fashion|designer/i.test(textVal)) {
          scores.design += 5;
        }
        if (/law|court|legal|judge|lawyer|advocate|justice|clat|corporate|attorney/i.test(textVal)) {
          scores.law += 5;
        }
        if (/business|startup|founder|entrepreneur|management|marketing|venture|product/i.test(textVal)) {
          scores.business += 5;
        }
        if (/finance|investment|bank|stock|economics|ca|wealth|audits|tax|treasury/i.test(textVal)) {
          scores.finance += 5;
        }
        if (/teach|school|mentor|education|coaching|tutor|curriculum|academic|lecture/i.test(textVal)) {
          scores.education += 5;
        }
        if (/farm|agriculture|plants|wildlife|conservation|nature|forest|ecology|green/i.test(textVal)) {
          scores.agriculture += 5;
        }
      }
    }
  });

  const sortedFields = Object.keys(scores)
    .map(key => ({
      id: key,
      score: scores[key],
      meta: FIELD_META[key]
    }))
    .sort((a, b) => b.score - a.score);

  const topFields = sortedFields.slice(0, 3).map((f, idx) => {
    const percentage = Math.min(98, Math.max(62, 65 + (f.score * 3) - (idx * 8)));
    return {
      rank: idx + 1,
      field: f.meta.name,
      matchPercent: percentage,
      emoji: f.meta.emoji,
      oneLiner: f.meta.oneLiner
    };
  });

  const primaryKey = sortedFields[0].id;
  const primaryMeta = FIELD_META[primaryKey];
  const secondaryKey = sortedFields[1].id;
  const secondaryMeta = FIELD_META[secondaryKey];
  const tertiaryKey = sortedFields[2].id;
  const tertiaryMeta = FIELD_META[tertiaryKey];

  const primaryCareers = (FALLBACK_CAREERS[primaryKey] || []).map((c) => ({
    title: c.title,
    field: primaryMeta.name,
    emoji: c.emoji,
    whyItFits: c.why,
    requiredSubjects: c.subs,
    entranceExam: c.exams,
  }));

  const secondaryCareers = (FALLBACK_CAREERS[secondaryKey] || []).map((c) => ({
    title: c.title,
    field: secondaryMeta.name,
    emoji: c.emoji,
    whyItFits: c.why,
    requiredSubjects: c.subs,
    entranceExam: c.exams,
  }));

  const tertiaryCareers = (FALLBACK_CAREERS[tertiaryKey] || []).map((c) => ({
    title: c.title,
    field: tertiaryMeta.name,
    emoji: c.emoji,
    whyItFits: c.why,
    requiredSubjects: c.subs,
    entranceExam: c.exams,
  }));

  const combinedCareers = [...primaryCareers, ...secondaryCareers, ...tertiaryCareers];
  const careers = combinedCareers.map((c, idx) => ({
    rank: idx + 1,
    title: c.title,
    field: c.field,
    emoji: c.emoji,
    whyItFits: c.whyItFits,
    requiredSubjects: c.requiredSubjects,
    entranceExam: c.entranceExam,
    confidenceFlag: idx < 6 ? "strong_match" : idx < 12 ? "good_match" : idx < 15 ? "likely_match" : "needs_exploration"
  }));

  const riasecVector = calculateRiasecVector(studentClass, studentStream, quickFacts, messages);
  const hollandCode = getHollandProfileString(riasecVector);

  const classPhrase = studentClass 
    ? (studentClass.toLowerCase().includes("class") ? `As a student of ${studentClass}` : `As a student in ${studentClass}`)
    : `As a learner`;

  const personalMessage = `Hello ${studentName}! It was an absolute pleasure chatting with you today. ${classPhrase}, your alignment with ${primaryMeta.name} is a magnificent and highly promising signal! Your passion for the subjects and activities we discussed shows great potential. Keep your mind open, continue exploring, and trust your unique path! Kalam Spark is always cheering for you.`;

  return {
    topFields,
    topCareers: careers,
    personalMessage,
    strengthsSeen: [
      `Excellent active conversational skills and logical expression`,
      `Strong interest in real-world application of ${quickFacts?.favouriteSubject || "your favorite subject"}`,
      `Creative builder mindset with a focus on practical solutions`
    ],
    skillsToBuild: [
      `Deep focus on foundations in ${primaryMeta.name}`,
      `Practical hands-on mini projects and laboratory experiments`,
      `Communication, design, and systematic planning`,
      `Familiarity with standard evaluation requirements like ${primaryMeta.entranceExam}`
    ],
    roadmap: {
      now: `Focus on mastering ${quickFacts?.favouriteSubject || "your favorite subject"} in school.`,
      class10: `Take up suitable subjects based on your chosen career track.`,
      class1112: `Prepare for top-tier college entries and evaluations like ${primaryMeta.entranceExam}.`,
      after12: `Secure admissions at premier institutions in the field.`
    },
    realityCheckFlag: {
      career: careers[0].title,
      issue: "N/A",
      suggestion: "Maintain excellent foundational understanding."
    },
    overallConfidence: "strong_match",
    confidenceReason: "Conversational responses demonstrated high alignment and logical clarity.",
    hollandCode,
    riasecVector
  };
}
