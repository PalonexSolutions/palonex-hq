import { Accessibility, Apple, CalendarDays, Eye, GraduationCap, House, Pill, type LucideIcon } from "lucide-react";

type Detail = { title: string; text: string };

export type Product = {
  slug: string;
  name: string;
  category: string;
  description: string;
  headline: string;
  icon: LucideIcon;
  motif: "rings" | "blocks" | "grid" | "steps" | "lens" | "calendar" | "waves";
  featured?: boolean;
  useCasesFirst?: boolean;
  problem: string;
  solution: string;
  capabilities: Detail[];
  audience: string;
  useCases: Detail[];
  direction: string;
};

export const products: readonly Product[] = [
  {
    slug: "foodsnap", name: "FoodSnap", category: "Food intelligence", icon: Apple, motif: "rings", featured: true,
    description: "A concept for tracking food freshness, nutrition and inventory.",
    headline: "Make better use of what’s in your kitchen.",
    problem: "It’s easy to lose track of ingredients once they’re put away. Labels, storage dates and meal plans rarely live in the same place.",
    solution: "FoodSnap would bring pantry records and food information into one view, so households can decide what to use first and plan around what they already have.",
    capabilities: [
      { title: "Pantry inventory", text: "Log ingredients, quantities and storage dates in an editable list." },
      { title: "Use-first reminders", text: "Surface items based on recorded dates and storage information." },
      { title: "Nutrition references", text: "Look up nutrition data and see its source and serving size." },
    ],
    audience: "Home cooks, shared households and people planning meals on a budget.",
    useCases: [
      { title: "Before a grocery run", text: "Check what’s already in the pantry and what needs replacing." },
      { title: "At meal planning time", text: "Start with ingredients that have been in storage the longest." },
    ],
    direction: "Explore a manual inventory prototype before evaluating photo-assisted logging. Freshness estimates would need clear uncertainty and food-safety guidance.",
  },
  {
    slug: "rentify", name: "Rentify", category: "Housing discovery", icon: House, motif: "blocks", useCasesFirst: true,
    description: "A concept for comparing rentals and exploring roommate compatibility.",
    headline: "Find a place that fits how you live.",
    problem: "Renters often compare scattered listings while trying to account for commute, total costs and shared-house expectations.",
    solution: "Rentify would organize rental options around preferences the renter chooses, with explainable comparisons and optional roommate criteria.",
    capabilities: [
      { title: "Explainable shortlists", text: "Show how each option matches chosen price, location and amenity preferences." },
      { title: "Total cost comparison", text: "Record deposits, fees and monthly costs alongside base rent." },
      { title: "Shared-living preferences", text: "Compare household routines with information each participant chooses to share." },
    ],
    audience: "Students moving to a new city, first-time renters and people exploring shared housing.",
    useCases: [
      { title: "Compare two neighborhoods", text: "Review possible trade-offs between rent and commute." },
      { title: "Prepare for a roommate conversation", text: "Use shared preferences to discuss routines before arranging a visit." },
    ],
    direction: "Start by testing structured comparisons with renter-entered listings. Evaluate listing provenance, consent and fair-housing safeguards before considering recommendations.",
  },
  {
    slug: "mediassist", name: "MediAssist", category: "Medicine information", icon: Pill, motif: "grid",
    description: "A concept for finding reliable medicine and prescription information.",
    headline: "Read medicine information with more context.",
    problem: "Medicine leaflets and prescriptions can contain unfamiliar terms, and similarly named products can be easy to confuse.",
    solution: "MediAssist would help people locate source-linked medicine information and prepare questions for a pharmacist or clinician.",
    capabilities: [
      { title: "Source-linked summaries", text: "Link explanations to the relevant official reference or leaflet." },
      { title: "Identity confirmation", text: "Ask the reader to confirm the name and strength before opening information." },
      { title: "Question preparation", text: "Organize points to raise with a healthcare professional." },
    ],
    audience: "People reading their own medicine information and caregivers helping them prepare for a consultation.",
    useCases: [
      { title: "Read a new leaflet", text: "Locate an explanation of an unfamiliar label term." },
      { title: "Prepare for a pharmacy visit", text: "Bring questions about instructions that need clarification." },
    ],
    direction: "Evaluate reference quality, language clarity and privacy with professional input. Scope the concept to information lookup and consultation preparation.",
  },
  {
    slug: "skilledge", name: "SkillEdge", category: "Education and careers", icon: GraduationCap, motif: "steps", featured: true, useCasesFirst: true,
    description: "A concept for exploring career paths, courses and learning priorities.",
    headline: "Turn a career interest into a learning plan.",
    problem: "Course catalogs and job descriptions offer plenty of choices but rarely explain which skills to learn first or how to practise them.",
    solution: "SkillEdge would turn a learner’s goals, current skills and time budget into an editable set of learning milestones.",
    capabilities: [
      { title: "Role and skill mapping", text: "Explore the skills associated with a role and record prior experience." },
      { title: "Resource comparison", text: "Compare courses by prerequisites, format, cost and time commitment." },
      { title: "Practice milestones", text: "Pair learning goals with projects that demonstrate progress." },
    ],
    audience: "Students, early-career professionals and people exploring a career change.",
    useCases: [
      { title: "Choose a first course", text: "Compare prerequisites before committing to a course." },
      { title: "Connect study to a portfolio", text: "Plan a project around skills practised during a learning milestone." },
    ],
    direction: "Prototype editable pathways for a small set of roles and evaluate whether learners understand the reasoning behind each suggested step.",
  },
  {
    slug: "visioncare", name: "VisionCare", category: "Visual accessibility", icon: Eye, motif: "lens",
    description: "A concept for on-demand visual descriptions and text access.",
    headline: "Make visual information easier to access.",
    problem: "Everyday labels, signs and images can be difficult to read or interpret without an accessible alternative.",
    solution: "VisionCare would explore user-controlled capture and short audio or text descriptions of everyday visual information.",
    capabilities: [
      { title: "Text access", text: "Explore reading visible text aloud with controls for repetition and pace." },
      { title: "On-demand descriptions", text: "Describe the content of a captured image and indicate uncertainty." },
      { title: "Accessible capture controls", text: "Evaluate usable camera controls and feedback with assistive technology." },
    ],
    audience: "Blind and low-vision users and people who prefer spoken access to visual information.",
    useCases: [
      { title: "Read a printed notice", text: "Capture a notice to hear the visible text." },
      { title: "Explore a photograph", text: "Request a brief description to understand the general scene." },
    ],
    direction: "Co-design a low-risk reading prototype with blind and low-vision participants. Evaluate privacy and description accuracy before expanding the scope.",
  },
  {
    slug: "eventease", name: "EventEase", category: "Event planning", icon: CalendarDays, motif: "calendar", useCasesFirst: true,
    description: "A concept for coordinating event schedules, responsibilities and contingencies.",
    headline: "Keep the plan visible as the event changes.",
    problem: "A single schedule change can affect suppliers, volunteers and guests, especially when each group is using a different checklist.",
    solution: "EventEase would keep decisions, schedules and responsibilities together, with suggestions that organizers can review before sharing updates.",
    capabilities: [
      { title: "Run-of-show planning", text: "Create a shared timeline and see dependencies between tasks." },
      { title: "Responsibilities", text: "Assign owners and record what needs confirmation." },
      { title: "Contingency drafts", text: "Draft fallback plans for changes to space, timing or attendance." },
    ],
    audience: "Campus event teams, community organizers and small organizations coordinating gatherings.",
    useCases: [
      { title: "Prepare a workshop", text: "Coordinate presenters, setup and check-in using a shared timeline." },
      { title: "Adjust an outdoor meetup", text: "Review what needs to change if the venue moves indoors." },
    ],
    direction: "Try a checklist and timeline prototype with small events before exploring automated planning suggestions.",
  },
  {
    slug: "talksign", name: "TalkSign", category: "Communication accessibility", icon: Accessibility, motif: "waves", featured: true,
    description: "A concept for exploring sign-language accessibility and communication support.",
    headline: "Support more ways to take part in a conversation.",
    problem: "Access to sign-language support varies across settings, and signing conventions depend on language, region and context.",
    solution: "TalkSign would explore narrowly scoped learning and communication aids co-designed with Deaf signers, with user control over when and how assistance is used.",
    capabilities: [
      { title: "Language-specific references", text: "Explore short, reviewed examples for a clearly identified sign language." },
      { title: "Practice support", text: "Study and replay examples at a comfortable pace." },
      { title: "Consent-led capture", text: "Investigate optional, explicit capture controls for future recognition experiments." },
    ],
    audience: "Deaf signers involved in co-design, learners and hearing people looking for more accessible ways to communicate.",
    useCases: [
      { title: "Prepare for an introduction", text: "Review community-approved examples before a low-stakes conversation." },
      { title: "Practise after class", text: "Revisit a sign-language reference at your own pace." },
    ],
    direction: "Begin with community-led discovery and reviewed references. Any translation research would require consent, language-specific evaluation and input from Deaf signers.",
  },
];

export function productPath(slug: string) {
  return `/products/${slug}`;
}
