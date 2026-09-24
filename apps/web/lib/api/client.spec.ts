import { ApiError } from "./client";

describe("API Client Error Handling", () => {
  it("should format ApiError correctly with statusCode and custom message", () => {
    const err = new ApiError(403, "Access Denied: You lack required RBAC permissions.");
    expect(err.statusCode).toBe(403);
    expect(err.message).toBe("Access Denied: You lack required RBAC permissions.");
    expect(err.name).toBe("ApiError");
  });

  it("should encapsulate 400 validation error responses", () => {
    const validationData = {
      statusCode: 400,
      message: ["code must be a string", "name should not be empty"],
      error: "Bad Request",
    };
    const err = new ApiError(400, "Validation failed", validationData);
    expect(err.statusCode).toBe(400);
    expect(err.data).toEqual(validationData);
  });
});
