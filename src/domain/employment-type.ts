import { JobType } from "@/core/model";

import type { EmploymentType } from "@/domain/types";

export function toScraperJobType(value: EmploymentType | undefined): JobType | null {
  if (!value) {
    return null;
  }

  switch (value) {
    case "fullTime":
      return JobType.FULL_TIME;
    case "partTime":
      return JobType.PART_TIME;
    case "contract":
      return JobType.CONTRACT;
    case "internship":
      return JobType.INTERNSHIP;
    case "temporary":
      return JobType.TEMPORARY;
    case "other":
      return JobType.OTHER;
    default:
      return null;
  }
}

export function toDomainEmploymentType(value: JobType): EmploymentType {
  switch (value) {
    case JobType.FULL_TIME:
      return "fullTime";
    case JobType.PART_TIME:
      return "partTime";
    case JobType.CONTRACT:
      return "contract";
    case JobType.INTERNSHIP:
      return "internship";
    case JobType.TEMPORARY:
      return "temporary";
    default:
      return "other";
  }
}
