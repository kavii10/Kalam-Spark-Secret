export const SUBJECTS: string[] = [
  "Maths",
  "Science (Biology)",
  "Science (Physics)",
  "Science (Chemistry)",
  "Computer Science",
  "Social Studies",
  "Economics",
  "Art/Music",
  "Physical Education",
  "Other"
];

export const INTERESTS_LIST: string[] = [
  "Technology & Coding",
  "Science & Research",
  "Art & Design",
  "Business & Finance",
  "Healthcare & Medicine",
  "Engineering",
  "Media & Communication",
  "Law & Justice",
  "Teaching & Education",
  "Music & Performance",
  "Social Work & NGOs",
  "Space & Aviation",
  "Other Area"
];

export const isIllegalCareer = (dream: string): boolean => {
  if (!dream) return false;
  const dreamLower = dream.toLowerCase().trim();
  
  const illegalKeywords = [
    "criminal", "mafia", "hijack", "hijacking", "terrorist", "terrorism", 
    "drug dealer", "drug lord", "smuggler", "contraband", "cartel", "hitman", "assassin",
    "thief", "robber", "pickpocket", "gangster", "yakuza", "triad", "underworld don",
    "money launderer", "tax evader", "kidnapper", "extortionist", "extorter",
    "scammer", "fraudster", "human trafficker", "sex trafficker", "carder", "phisher",
    "pirate", "black hat", "cybercriminal", "illegal hacker", "ransomware operator",
    "bootlegger", "counterfeiter", "hacker for hire", "bank robber", "murderer", "prostitute"
  ];
  
  const legalExceptions = [
    "ethical", "security", "defense", "cybersecurity", "analyst", "police", "officer", 
    "detective", "investigator", "criminologist", "law", "attorney", "judge", "prosecutor",
    "anti-money laundering", "aml", "compliance"
  ];
  
  for (const kw of illegalKeywords) {
    if (dreamLower.includes(kw)) {
      if (legalExceptions.some(exc => dreamLower.includes(exc))) {
        return false;
      }
      return true;
    }
  }
  return false;
};
