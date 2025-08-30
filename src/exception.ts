export class LinkedInException extends Error {
  constructor(message = "An error occurred with LinkedIn") {
    super(message);
    this.name = "LinkedInException";
  }
}

export class IndeedException extends Error {
  constructor(message = "An error occurred with Indeed") {
    super(message);
    this.name = "IndeedException";
  }
}

export class ZipRecruiterException extends Error {
  constructor(message = "An error occurred with ZipRecruiter") {
    super(message);
    this.name = "ZipRecruiterException";
  }
}

export class GlassdoorException extends Error {
  constructor(message = "An error occurred with Glassdoor") {
    super(message);
    this.name = "GlassdoorException";
  }
}

export class GoogleJobsException extends Error {
  constructor(message = "An error occurred with Google Jobs") {
    super(message);
    this.name = "GoogleJobsException";
  }
}

export class BaytException extends Error {
  constructor(message = "An error occurred with Bayt") {
    super(message);
    this.name = "BaytException";
  }
}

export class NaukriException extends Error {
  constructor(message = "An error occurred with Naukri") {
    super(message);
    this.name = "NaukriException";
  }
}

export class BDJobsException extends Error {
  constructor(message = "An error occurred with BDJobs") {
    super(message);
    this.name = "BDJobsException";
  }
}
