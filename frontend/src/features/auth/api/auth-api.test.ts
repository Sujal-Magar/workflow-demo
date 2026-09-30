import { afterEach, describe, expect, it, vi } from "vitest";

import { toAuthFailure, type AuthOperation, type AuthResult } from "../lib/auth-error";
import {
  getCurrentUser,
  googleOAuthLogin,
  login,
  logout,
  refreshSession,
  register,
  requestPasswordReset,
  resetPassword,
} from "./auth-api";

const clientSends = vi.hoisted(() => ({
  register: vi.fn(),
  login: vi.fn(),
  googleOAuthLogin: vi.fn(),
  refreshSession: vi.fn(),
  getCurrentUser: vi.fn(),
  logout: vi.fn(),
  requestPasswordReset: vi.fn(),
  resetPassword: vi.fn(),
}));

vi.mock("@/lib/api-client", () => ({
  authApiClient: {
    register: { mutate: clientSends.register },
    login: { mutate: clientSends.login },
    googleOAuthLogin: { mutate: clientSends.googleOAuthLogin },
    refreshSession: { mutate: clientSends.refreshSession },
    getCurrentUser: { query: clientSends.getCurrentUser },
    logout: { mutate: clientSends.logout },
    requestPasswordReset: { mutate: clientSends.requestPasswordReset },
    resetPassword: { mutate: clientSends.resetPassword },
  },
}));

const USER = { id: "3f2b8c1e-5d4a-4e6f-9a7b-1c2d3e4f5a6b", name: "Piyush Kumar", email: "piyush@example.com" };
const SESSION = { user: USER, accessToken: "access-token-1", expiresIn: 900 };
const RESET_ACK = { success: true, message: "If an account exists for that email, a reset link has been sent." };

interface OperationCase {
  readonly call: () => Promise<AuthResult<unknown>>;
  readonly expectedRequest: unknown;
  readonly successStatus: number;
  readonly successBody: unknown;
  /** One field of the submitting form, used for the mappable VALIDATION_ERROR case (`null` = no form fields). */
  readonly formField: string | null;
  readonly declaredErrors: ReadonlyArray<readonly [number, string, string]>;
}

const SIGN_UP = { name: "Piyush Kumar", email: USER.email, password: "Passw0rd!", confirmPassword: "Passw0rd!" };
const SIGN_IN = { email: USER.email, password: "Passw0rd!" };
const RESET = { token: "reset-token", password: "Passw0rd!", confirmPassword: "Passw0rd!" };

const OPERATIONS: Readonly<Record<AuthOperation, OperationCase>> = {
  register: {
    call: () => register(SIGN_UP),
    expectedRequest: { body: SIGN_UP },
    successStatus: 201,
    successBody: SESSION,
    formField: "email",
    declaredErrors: [[409, "EMAIL_ALREADY_EXISTS", "email-exists"]],
  },
  login: {
    call: () => login(SIGN_IN),
    expectedRequest: { body: SIGN_IN },
    successStatus: 200,
    successBody: SESSION,
    formField: "password",
    declaredErrors: [[401, "INVALID_CREDENTIALS", "invalid-credentials"]],
  },
  googleOAuthLogin: {
    call: () => googleOAuthLogin({ token: "google-token" }),
    expectedRequest: { body: { token: "google-token" } },
    successStatus: 200,
    successBody: SESSION,
    formField: null,
    declaredErrors: [[401, "INVALID_GOOGLE_TOKEN", "invalid-google-token"]],
  },
  refreshSession: {
    call: () => refreshSession(),
    expectedRequest: undefined,
    successStatus: 200,
    successBody: SESSION,
    formField: null,
    declaredErrors: [[401, "UNAUTHENTICATED", "unauthenticated"]],
  },
  getCurrentUser: {
    call: () => getCurrentUser(),
    expectedRequest: undefined,
    successStatus: 200,
    successBody: { user: USER },
    formField: null,
    declaredErrors: [[401, "UNAUTHENTICATED", "unauthenticated"]],
  },
  logout: {
    call: () => logout(),
    expectedRequest: undefined,
    successStatus: 200,
    successBody: { success: true },
    formField: null,
    declaredErrors: [],
  },
  requestPasswordReset: {
    call: () => requestPasswordReset({ email: USER.email }),
    expectedRequest: { body: { email: USER.email } },
    successStatus: 200,
    successBody: RESET_ACK,
    formField: "email",
    declaredErrors: [],
  },
  resetPassword: {
    call: () => resetPassword(RESET),
    expectedRequest: { body: RESET },
    successStatus: 200,
    successBody: { success: true },
    formField: "confirmPassword",
    declaredErrors: [[400, "INVALID_RESET_TOKEN", "invalid-reset-token"]],
  },
};

const OPERATION_NAMES = Object.keys(OPERATIONS) as AuthOperation[];
const WITH_VALIDATION = OPERATION_NAMES.filter(
  (name) => !["refreshSession", "getCurrentUser", "logout"].includes(name)
);

function respond(operation: AuthOperation, status: number, body: unknown): void {
  clientSends[operation].mockResolvedValue({ status, body, headers: new Headers() });
}

function errorBody(code: string, fieldErrors?: Record<string, string>) {
  return fieldErrors ? { code, message: "Request failed.", fieldErrors } : { code, message: "Request failed." };
}

afterEach(() => {
  Object.values(clientSends).forEach((send) => send.mockReset());
});

describe("T-UI-18 · auth-api response mapping", () => {
  describe.each(OPERATION_NAMES)("%s", (operation) => {
    const spec = OPERATIONS[operation];

    it("maps the declared success status to the success result and sends the request through the client", async () => {
      respond(operation, spec.successStatus, spec.successBody);

      const result = await spec.call();

      expect(result).toEqual({ ok: true, data: spec.successBody });
      expect(clientSends[operation]).toHaveBeenCalledTimes(1);
      if (spec.expectedRequest !== undefined) {
        expect(clientSends[operation]).toHaveBeenCalledWith(spec.expectedRequest);
      }
    });

    it("maps a success status with a body that fails the contract schema to unexpected", async () => {
      respond(operation, spec.successStatus, { unexpected: true });

      expect(await spec.call()).toEqual({ ok: false, failure: { kind: "unexpected" } });
    });

    it.each(spec.declaredErrors)("maps %i %s to its failure variant", async (status, code, kind) => {
      respond(operation, status, errorBody(code));

      expect(await spec.call()).toEqual({ ok: false, failure: { kind } });
    });

    it.each([
      ["404 NOT_FOUND", 404, errorBody("NOT_FOUND")],
      ["403 with a declared-looking code", 403, errorBody("UNAUTHENTICATED")],
      ["500 INTERNAL_ERROR", 500, errorBody("INTERNAL_ERROR")],
      ["502 without a body", 502, undefined],
      ["a malformed error body", 400, { error: "bad" }],
      ["a 409 with an unknown code", 409, errorBody("SOMETHING_ELSE")],
    ])("maps an undeclared outcome (%s) to unexpected", async (_label, status, body) => {
      respond(operation, status, body);

      expect(await spec.call()).toEqual({ ok: false, failure: { kind: "unexpected" } });
    });

    it("maps a network failure (the request rejects) to unexpected", async () => {
      clientSends[operation].mockRejectedValue(new TypeError("Failed to fetch"));

      expect(await spec.call()).toEqual({ ok: false, failure: { kind: "unexpected" } });
    });
  });

  it.each([
    ["register", 401, "UNAUTHENTICATED"],
    ["login", 409, "EMAIL_ALREADY_EXISTS"],
    ["login", 401, "UNAUTHENTICATED"],
    ["googleOAuthLogin", 401, "INVALID_CREDENTIALS"],
    ["refreshSession", 400, "VALIDATION_ERROR"],
    ["getCurrentUser", 401, "INVALID_CREDENTIALS"],
    ["logout", 401, "UNAUTHENTICATED"],
    ["requestPasswordReset", 400, "INVALID_RESET_TOKEN"],
    ["resetPassword", 401, "INVALID_RESET_TOKEN"],
  ] as const)("maps %s %i %s (declared status or code, not both) to unexpected", async (operation, status, code) => {
    respond(operation, status, errorBody(code, code === "VALIDATION_ERROR" ? { email: "x" } : undefined));

    expect(await OPERATIONS[operation].call()).toEqual({ ok: false, failure: { kind: "unexpected" } });
  });

  describe.each(WITH_VALIDATION)("%s VALIDATION_ERROR", (operation) => {
    const spec = OPERATIONS[operation];

    it("maps an empty fieldErrors map to unexpected (A-4)", async () => {
      respond(operation, 400, errorBody("VALIDATION_ERROR", {}));

      expect(await spec.call()).toEqual({ ok: false, failure: { kind: "unexpected" } });
    });

    it("maps a map holding only `token` to unexpected (A-4)", async () => {
      respond(operation, 400, errorBody("VALIDATION_ERROR", { token: "Token is required." }));

      expect(await spec.call()).toEqual({ ok: false, failure: { kind: "unexpected" } });
    });

    it("passes fieldErrors through when a form field can show one", async () => {
      if (!spec.formField) {
        respond(operation, 400, errorBody("VALIDATION_ERROR", { email: "Enter a valid email address." }));
        expect(await spec.call()).toEqual({ ok: false, failure: { kind: "unexpected" } });
        return;
      }
      const fieldErrors = { [spec.formField]: "Message.", token: "Token is required." };
      respond(operation, 400, errorBody("VALIDATION_ERROR", fieldErrors));

      expect(await spec.call()).toEqual({ ok: false, failure: { kind: "field-errors", fieldErrors } });
    });
  });
});

describe("T-UI-18 · toAuthFailure", () => {
  it("uses the given form fields to decide whether a VALIDATION_ERROR is displayable", () => {
    const outcome = {
      kind: "response",
      status: 400,
      body: errorBody("VALIDATION_ERROR", { token: "Token is required." }),
    } as const;

    expect(toAuthFailure("resetPassword", outcome, ["token"])).toEqual({
      kind: "field-errors",
      fieldErrors: { token: "Token is required." },
    });
    expect(toAuthFailure("resetPassword", outcome)).toEqual({ kind: "unexpected" });
  });

  it("treats a VALIDATION_ERROR without fieldErrors as unexpected", () => {
    expect(toAuthFailure("login", { kind: "response", status: 400, body: errorBody("VALIDATION_ERROR") })).toEqual({
      kind: "unexpected",
    });
  });

  it("maps a network error to unexpected", () => {
    expect(toAuthFailure("register", { kind: "network-error" })).toEqual({ kind: "unexpected" });
  });
});
