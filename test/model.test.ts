import { describe, expect, it } from "bun:test";

import { Country, Location } from "../src/model.js";

describe("Country", () => {
  it("parses aliases with fromString", () => {
    expect(Country.fromString("usa")).toBe(Country.USA);
    expect(Country.fromString("united kingdom")).toBe(Country.UK);
    expect(Country.fromString("bangladesh")).toBe(Country.BANGLADESH);
  });

  it("returns indeed domain value with api code", () => {
    expect(Country.USA.indeedDomainValue).toEqual(["www", "US"]);
    expect(Country.UK.indeedDomainValue).toEqual(["uk", "GB"]);
  });

  it("returns glassdoor domain value", () => {
    expect(Country.USA.glassdoorDomainValue).toBe("www.glassdoor.com");
    expect(Country.SWITZERLAND.glassdoorDomainValue).toBe("de.glassdoor.ch");
  });
});

describe("Location", () => {
  it("formats display location with enum country", () => {
    const location = new Location({ city: "San Francisco", state: "CA", country: Country.USA });
    expect(location.displayLocation()).toBe("San Francisco, CA, USA");
  });

  it("formats display location with string country", () => {
    const location = new Location({ city: "Dhaka", country: "Bangladesh" });
    expect(location.displayLocation()).toBe("Dhaka, Bangladesh");
  });
});
