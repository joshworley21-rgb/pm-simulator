/**
 * Key-person presets for the UK 5-party cast.
 *
 * All politicians are original fictional characters. The `familyOrigin` /
 * `education` / trait / goal values intentionally use the SAME literal unions
 * the donor engine already accepts (so no type changes are required yet).
 */

import type { PersonalityTrait, HiddenGoal } from '../types/mp';
import type { FamilyOrigin, Education } from '../types/background';

export interface KeyPersonPreset {
  personName: string;
  age: number;
  hometown: string;
  career: string;
  familyOrigin: FamilyOrigin;
  education: Education;
  personalityTraits: PersonalityTrait[];
  hiddenGoals: HiddenGoal[];
}

export const KEY_PEOPLE_PRESETS: Record<string, KeyPersonPreset[]> = {
  // ===== Conservative (conservative) =====
  conservative: [
    {
      personName: 'Richard Hartley', age: 61, hometown: 'Surrey', career: 'Investment banker',
      familyOrigin: 'political_family', education: 'private_elite',
      personalityTraits: ['charismatic', 'pragmatic', 'ambitious_trait'],
      hiddenGoals: ['become_prime_minister', 'pass_tax_reform'],
    },
    {
      personName: 'Eleanor Wainwright', age: 49, hometown: 'Cheltenham', career: 'Television producer',
      familyOrigin: 'journalist', education: 'top_university',
      personalityTraits: ['analytical', 'ambitious_trait', 'deceitful'],
      hiddenGoals: ['gain_media_attention', 'expand_faction'],
    },
    {
      personName: 'Marcus Okafor', age: 55, hometown: 'Birmingham', career: 'King\u2019s Counsel',
      familyOrigin: 'lawyer', education: 'national_university',
      personalityTraits: ['honest', 'stubborn', 'traditional'],
      hiddenGoals: ['become_health_minister', 'maintain_status_quo'],
    },
    {
      personName: 'Charles Beaumont', age: 58, hometown: 'Hampshire', career: 'Property developer',
      familyOrigin: 'business_family', education: 'private_elite',
      personalityTraits: ['greedy', 'pragmatic', 'cautious'],
      hiddenGoals: ['accumulate_wealth', 'expand_faction'],
    },
    {
      personName: 'Philippa Ashworth', age: 47, hometown: 'Oxfordshire', career: 'Management consultant',
      familyOrigin: 'political_family', education: 'top_university',
      personalityTraits: ['decisive', 'aggressive', 'ambitious_trait'],
      hiddenGoals: ['become_prime_minister', 'pass_tax_reform'],
    },
    {
      personName: 'George Redfern', age: 62, hometown: 'Berkshire', career: 'Army officer (retired)',
      familyOrigin: 'other', education: 'national_university',
      personalityTraits: ['brave', 'traditional', 'stubborn'],
      hiddenGoals: ['become_defense_minister', 'maintain_status_quo'],
    },
    {
      personName: 'Harriet Colville', age: 53, hometown: 'Cambridge', career: 'Civil servant',
      familyOrigin: 'bureaucrat_family', education: 'top_university',
      personalityTraits: ['diligent', 'cautious', 'moderate'],
      hiddenGoals: ['maintain_status_quo', 'pass_healthcare_reform'],
    },
  ],

  // ===== Labour (reform) =====
  reform: [
    {
      personName: 'Daniel Mercer', age: 54, hometown: 'Leeds', career: 'Trade union organiser',
      familyOrigin: 'union_cadre', education: 'national_university',
      personalityTraits: ['charismatic', 'empathetic', 'pragmatic'],
      hiddenGoals: ['become_prime_minister', 'pass_labor_reform'],
    },
    {
      personName: 'Aisha Rahman', age: 45, hometown: 'Manchester', career: 'Barrister',
      familyOrigin: 'journalist', education: 'top_university',
      personalityTraits: ['analytical', 'progressive', 'gregarious'],
      hiddenGoals: ['become_health_minister', 'gain_media_attention'],
    },
    {
      personName: 'Tom Calloway', age: 41, hometown: 'London', career: 'Political adviser',
      familyOrigin: 'political_family', education: 'top_university',
      personalityTraits: ['ambitious_trait', 'pragmatic', 'deceitful'],
      hiddenGoals: ['become_finance_minister', 'expand_faction'],
    },
    {
      personName: "Grace O'Donnell", age: 50, hometown: 'Newcastle', career: 'Trade union official',
      familyOrigin: 'union_cadre', education: 'regional_university',
      personalityTraits: ['diligent', 'brave', 'stubborn'],
      hiddenGoals: ['pass_labor_reform', 'expand_faction'],
    },
    {
      personName: 'James Whitfield', age: 38, hometown: 'Sheffield', career: 'Teacher',
      familyOrigin: 'other', education: 'national_university',
      personalityTraits: ['idealistic', 'honest', 'moderate'],
      hiddenGoals: ['pass_healthcare_reform', 'maintain_status_quo'],
    },
    {
      personName: 'Priya Nair', age: 44, hometown: 'Birmingham', career: 'Economist',
      familyOrigin: 'business_family', education: 'top_university',
      personalityTraits: ['analytical', 'calm', 'pragmatic'],
      hiddenGoals: ['become_finance_minister', 'pass_tax_reform'],
    },
    {
      personName: 'Oliver Stanmore', age: 36, hometown: 'Bristol', career: 'Local councillor',
      familyOrigin: 'journalist', education: 'national_university',
      personalityTraits: ['gregarious', 'cheerful', 'progressive'],
      hiddenGoals: ['gain_media_attention', 'expand_faction'],
    },
  ],

  // ===== Liberal Democrats (liberty) =====
  liberty: [
    {
      personName: 'Sophie Ashdown', age: 52, hometown: 'Bath', career: 'Broadcast journalist',
      familyOrigin: 'journalist', education: 'top_university',
      personalityTraits: ['charismatic', 'diplomatic', 'ambitious_trait'],
      hiddenGoals: ['become_prime_minister', 'gain_media_attention'],
    },
    {
      personName: 'Hugh Pemberton', age: 56, hometown: 'Winchester', career: 'Chartered accountant',
      familyOrigin: 'business_family', education: 'private_elite',
      personalityTraits: ['analytical', 'cautious', 'pragmatic'],
      hiddenGoals: ['become_finance_minister', 'pass_tax_reform'],
    },
    {
      personName: 'Nadia Ellis', age: 43, hometown: 'Bristol', career: 'Human rights lawyer',
      familyOrigin: 'other', education: 'national_university',
      personalityTraits: ['honest', 'brave', 'idealistic'],
      hiddenGoals: ['pass_labor_reform', 'gain_media_attention'],
    },
    {
      personName: 'Felicity Trent', age: 46, hometown: 'Chelmsford', career: 'Parliamentary researcher',
      familyOrigin: 'political_family', education: 'top_university',
      personalityTraits: ['gregarious', 'charismatic', 'ambitious_trait'],
      hiddenGoals: ['expand_faction', 'become_foreign_minister'],
    },
    {
      personName: 'Alistair Monroe', age: 57, hometown: 'Edinburgh', career: 'University lecturer',
      familyOrigin: 'professor', education: 'national_university',
      personalityTraits: ['analytical', 'moderate', 'honest'],
      hiddenGoals: ['maintain_status_quo', 'pass_healthcare_reform'],
    },
  ],

  // ===== Reform UK (populist) =====
  populist: [
    {
      personName: 'Nigel Crossley', age: 58, hometown: 'Doncaster', career: 'Entrepreneur',
      familyOrigin: 'business_family', education: 'regional_university',
      personalityTraits: ['charismatic', 'aggressive', 'cynical'],
      hiddenGoals: ['become_prime_minister', 'pass_tax_reform'],
    },
    {
      personName: 'Derek Hartley', age: 60, hometown: 'Blackpool', career: 'Factory owner',
      familyOrigin: 'other', education: 'regional_university',
      personalityTraits: ['stubborn', 'traditional', 'greedy'],
      hiddenGoals: ['accumulate_wealth', 'pass_labor_reform'],
    },
    {
      personName: 'Sandra Whitmore', age: 51, hometown: 'Southend', career: 'Talk radio host',
      familyOrigin: 'journalist', education: 'national_university',
      personalityTraits: ['gregarious', 'aggressive', 'radical'],
      hiddenGoals: ['gain_media_attention', 'destroy_rival_faction'],
    },
    {
      personName: 'Lee Bancroft', age: 44, hometown: 'Stoke-on-Trent', career: 'Community campaigner',
      familyOrigin: 'grassroots_activist', education: 'regional_university',
      personalityTraits: ['impulsive', 'brave', 'cynical'],
      hiddenGoals: ['destroy_rival_faction', 'expand_faction'],
    },
    {
      personName: 'Tamsin Drake', age: 47, hometown: 'Great Yarmouth', career: 'Small business owner',
      familyOrigin: 'other', education: 'national_university',
      personalityTraits: ['independent', 'pragmatic', 'stubborn'],
      hiddenGoals: ['pass_tax_reform', 'maintain_status_quo'],
    },
  ],

  // ===== Green (progressive) =====
  progressive: [
    {
      personName: 'Imogen Hale', age: 40, hometown: 'Brighton', career: 'Environmental campaigner',
      familyOrigin: 'grassroots_activist', education: 'national_university',
      personalityTraits: ['idealistic', 'charismatic', 'empathetic'],
      hiddenGoals: ['become_prime_minister', 'gain_media_attention'],
    },
    {
      personName: 'Ravi Chandrasekhar', age: 49, hometown: 'Bristol', career: 'Climate scientist',
      familyOrigin: 'professor', education: 'top_university',
      personalityTraits: ['analytical', 'idealistic', 'calm'],
      hiddenGoals: ['pass_healthcare_reform', 'gain_media_attention'],
    },
    {
      personName: 'Bethany Cole', age: 33, hometown: 'Norwich', career: 'Youth organiser',
      familyOrigin: 'grassroots_activist', education: 'regional_university',
      personalityTraits: ['progressive', 'cheerful', 'brave'],
      hiddenGoals: ['expand_faction', 'pass_labor_reform'],
    },
    {
      personName: 'Fraser Dunbar', age: 42, hometown: 'Glasgow', career: 'Rail union representative',
      familyOrigin: 'union_cadre', education: 'national_university',
      personalityTraits: ['stubborn', 'diligent', 'progressive'],
      hiddenGoals: ['pass_labor_reform', 'expand_faction'],
    },
    {
      personName: 'Yasmin Iqbal', age: 37, hometown: 'London', career: 'NHS doctor',
      familyOrigin: 'other', education: 'national_university',
      personalityTraits: ['empathetic', 'honest', 'diligent'],
      hiddenGoals: ['become_health_minister', 'pass_healthcare_reform'],
    },
  ],
};

export function findPersonPreset(partyId: string, personName: string): KeyPersonPreset | undefined {
  const partyPresets = KEY_PEOPLE_PRESETS[partyId];
  if (!partyPresets) return undefined;
  return partyPresets.find((p) => p.personName === personName);
}
