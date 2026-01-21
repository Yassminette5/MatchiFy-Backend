import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { MissionsService } from '../../missions/missions.service';
import { UserService } from '../../user/user.service';
import { SkillService } from '../../skill/skill.service';
import { User } from '../../user/schemas/user.schema';
import { getNormalizedWeights } from '../constants/model-weights';

export interface RankedTalent {
  talentId: string;
  fullName: string;
  score: number;
  skillMatch: number;
  experienceMatch: number;
  matchingSkills: string[];
  missionSkills: string[];
}

interface RankOptions {
  limit?: number;
  minScore?: number;
}

interface SkillLike {
  _id?: any;
  id?: any;
  name: string;
}

@Injectable()
export class TalentFilterService {
  private readonly logger = new Logger(TalentFilterService.name);

  constructor(
    private readonly missionsService: MissionsService,
    private readonly userService: UserService,
    private readonly skillService: SkillService,
  ) {}

  /**
   * Retourne une liste de talents classés par score de compatibilité pour une mission donnée.
   * Modèle simple :
   *  - similarité de compétences (skills overlap) => 70%
   *  - adéquation de l'expérience (proxy basé sur nb de skills + CV) => 30%
   */
  async rankTalentsForMission(
    missionId: string,
    options: RankOptions = {},
  ): Promise<RankedTalent[]> {
    const { limit = 50, minScore = 0 } = options;

    // 1. Charger la mission et ses compétences
    const mission = await this.missionsService.findOne(missionId);
    if (!mission) {
      throw new NotFoundException(`Mission ${missionId} not found`);
    }

    const requiredSkills: string[] = Array.isArray(mission.skills)
      ? mission.skills
      : [];

    // Support optionnel pour d'éventuelles "optionalSkills" sur la mission
    const optionalSkills: string[] = Array.isArray(
      (mission as any).optionalSkills,
    )
      ? ((mission as any).optionalSkills as string[])
      : [];

    const normalizedRequiredSkills = requiredSkills
      .map((s) => this.normalizeSkill(s))
      .filter(Boolean);

    const normalizedOptionalSkills = optionalSkills
      .map((s) => this.normalizeSkill(s))
      .filter(Boolean);

    if (normalizedRequiredSkills.length === 0) {
      this.logger.warn(
        `Mission ${missionId} has no skills defined, talent ranking will be less relevant`,
      );
    }

    // 2. Récupérer tous les talents
    const talents = await this.userService.findAllTalents();
    if (!talents || talents.length === 0) {
      return [];
    }

    // 3. Pré-charger les noms de compétences des talents (pour éviter N requêtes)
    const allSkillIds = new Set<string>();
    for (const talent of talents) {
      const talentSkills = (talent.skills || []) as string[];
      for (const id of talentSkills) {
        if (id) {
          allSkillIds.add(id);
        }
      }
    }

    const skillIdToName = await this.buildSkillIdToNameMap(
      Array.from(allSkillIds),
    );

    // 4. Calculer un score pour chaque talent
    const ranked: RankedTalent[] = [];

    for (const talent of talents) {
      const talentSkillIds = (talent.skills || []) as string[];
      const talentSkillNames = talentSkillIds
        .map((id) => skillIdToName.get(id))
        .filter((name): name is string => Boolean(name));

      const {
        matchScore: requiredMatch,
        matchingSkills: requiredMatching,
      } = this.computeSkillMatch(normalizedRequiredSkills, talentSkillNames);

      const {
        matchScore: optionalMatch,
        matchingSkills: optionalMatching,
      } = this.computeSkillMatch(normalizedOptionalSkills, talentSkillNames);

      const experienceMatch = this.computeExperienceMatch(
        mission.experienceLevel,
        talent,
      );

      const weights = getNormalizedWeights();
      const score01 =
        weights.requiredSkillsWeight * requiredMatch +
        weights.optionalSkillsWeight * optionalMatch +
        weights.experienceWeight * experienceMatch;

      const finalScore = 100 * Math.max(0, Math.min(1, score01));

      if (finalScore < minScore) {
        continue;
      }

      ranked.push({
        talentId: talent._id?.toString?.() ?? '',
        fullName: (talent as any).fullName ?? '',
        score: Math.round(finalScore),
        skillMatch: Number(requiredMatch.toFixed(3)),
        experienceMatch: Number(experienceMatch.toFixed(3)),
        matchingSkills: Array.from(
          new Set([...requiredMatching, ...optionalMatching]),
        ),
        missionSkills: requiredSkills,
      });
    }

    // 5. Trier par score décroissant et appliquer la limite
    ranked.sort((a, b) => b.score - a.score);
    return ranked.slice(0, limit);
  }

  /**
   * Construit une map skillId -> skillName
   */
  private async buildSkillIdToNameMap(
    skillIds: string[],
  ): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    if (!skillIds.length) {
      return map;
    }

    const skills = (await this.skillService.findByIds(
      skillIds,
    )) as SkillLike[];

    for (const skill of skills) {
      // SkillDocument peut être lean ou document, on gère les deux
      const id =
        (skill as any)._id?.toString?.() ??
        (skill as any).id ??
        (skill as any)._id;
      if (id) {
        map.set(id, skill.name);
      }
    }

    return map;
  }

  /**
   * Calcule la similarité de compétences entre mission et talent.
   * Retourne un score entre 0 et 1 + la liste des skills qui matchent.
   */
  private computeSkillMatch(
    normalizedMissionSkills: string[],
    talentSkillNames: string[],
  ): { matchScore: number; matchingSkills: string[] } {
    if (!normalizedMissionSkills.length) {
      return { matchScore: 0.5, matchingSkills: [] }; // neutre si mission sans skills
    }

    const missionSet = new Set(normalizedMissionSkills);
    const talentSet = new Set(
      talentSkillNames.map((s) => this.normalizeSkill(s)).filter(Boolean),
    );

    const matchingSkills: string[] = [];

    for (const missionSkill of missionSet) {
      for (const talentSkill of talentSet) {
        if (
          missionSkill === talentSkill ||
          missionSkill.includes(talentSkill) ||
          talentSkill.includes(missionSkill)
        ) {
          matchingSkills.push(missionSkill);
          break;
        }
      }
    }

    const overlapRatio = matchingSkills.length / missionSet.size;
    return {
      matchScore: Math.max(0, Math.min(1, overlapRatio)),
      matchingSkills,
    };
  }

  /**
   * Calcule un score d'adéquation d'expérience (0-1) entre le niveau demandé
   * par la mission et un proxy d'expérience du talent.
   */
  private computeExperienceMatch(
    missionExperienceLevel: string | undefined,
    talent: User,
  ): number {
    const required = this.mapExperienceLevelToScore(missionExperienceLevel);
    const talentScore = this.estimateTalentExperienceScore(talent);
    const diff = Math.abs(required - talentScore);
    return Math.max(0, Math.min(1, 1 - diff));
  }

  /**
   * Convertit le niveau d'expérience de la mission en score [0,1]
   */
  private mapExperienceLevelToScore(level?: string): number {
    switch (level) {
      case 'ENTRY':
        return 0.3;
      case 'INTERMEDIATE':
        return 0.6;
      case 'EXPERT':
        return 0.9;
      default:
        return 0.5; // neutre si non défini
    }
  }

  /**
   * Estime l'expérience d'un talent à partir de signaux simples :
   *  - nombre de skills
   *  - présence d'un CV
   */
  private estimateTalentExperienceScore(talent: User): number {
    let score = 0.2;

    const skillsCount = (talent.skills || []).length;
    if (skillsCount >= 10) {
      score += 0.5;
    } else if (skillsCount >= 5) {
      score += 0.35;
    } else if (skillsCount >= 2) {
      score += 0.2;
    } else if (skillsCount > 0) {
      score += 0.1;
    }

    if (talent.cvUrl) {
      score += 0.1;
    }

    return Math.max(0, Math.min(1, score));
  }

  private normalizeSkill(skill: string | undefined | null): string {
    return (skill || '').trim().toLowerCase();
  }
}


