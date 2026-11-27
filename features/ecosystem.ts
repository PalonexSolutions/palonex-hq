import { Accessibility, Apple, CalendarDays, Eye, GraduationCap, House, Pill } from "lucide-react";

export const products = [
  { name: "FoodSnap", category: "Food intelligence", description: "Food freshness, nutrition and inventory intelligence.", icon: Apple },
  { name: "Rentify", category: "Living", description: "AI-assisted rental and roommate discovery.", icon: House },
  { name: "MediAssist", category: "Medicine information", description: "Medicine and prescription information assistance.", icon: Pill },
  { name: "SkillEdge", category: "Education and careers", description: "Career, course and education recommendations.", icon: GraduationCap },
  { name: "VisionCare", category: "Visual accessibility", description: "AI-powered visual assistance and accessibility.", icon: Eye },
  { name: "EventEase", category: "Planning", description: "Intelligent event planning.", icon: CalendarDays },
  { name: "TalkSign", category: "Communication accessibility", description: "Sign-language accessibility and translation.", icon: Accessibility },
] as const;
