// Minimal in-house WebUntis client, replacing the third-party `webuntis` npm
// package (https://github.com/SchoolUtils/WebUntis). Only the endpoints this
// app actually uses are implemented:
//
//   - JSON-RPC (/WebUntis/jsonrpc.do): authenticate, logout, getTimetable,
//     getStudents, getTeachers
//   - REST (/WebUntis/api/classreg/absences/students): own absences
//
// Differences from the original library:
//   - Native fetch instead of axios + date-fns (zero dependencies).
//   - No validateSession round-trip before every call (the library issued an
//     extra getLatestImportTime RPC per request). Instead, if the server
//     reports "not authenticated" (-8520), we re-login once and retry.
//   - JSON-RPC `error` responses are surfaced with their real message instead
//     of being swallowed.

export interface SessionInformation {
  sessionId: string;
  personType: number;
  personId: number;
  klasseId?: number;
}

export interface UntisElement {
  id: number;
  name: string;
  longname?: string;
  externalkey?: string;
}

export interface Lesson {
  id: number;
  date: number; // YYYYMMDD
  startTime: number; // HHMM
  endTime: number; // HHMM
  kl?: UntisElement[];
  te?: UntisElement[];
  su?: UntisElement[];
  ro?: UntisElement[];
  code?: 'cancelled' | 'irregular';
  [key: string]: unknown;
}

export interface Person {
  id: number;
  name: string;
  foreName: string;
  longName: string;
  [key: string]: unknown;
}

export interface Absence {
  id: number;
  startDate: number;
  endDate: number;
  startTime: number;
  endTime: number;
  isExcused?: boolean;
  excuseStatus?: string | null;
  reason?: string;
  text?: string;
  [key: string]: unknown;
}

export interface AbsencesResult {
  absences: Absence[];
  [key: string]: unknown;
}

// JSON-RPC error code the server uses for missing/expired sessions.
const NOT_AUTHENTICATED = -8520;

function dateToUntis(date: Date): number {
  return (
    date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate()
  );
}

export class UntisError extends Error {
  constructor(
    message: string,
    public readonly code?: number,
  ) {
    super(message);
    this.name = 'UntisError';
  }
}

export class WebUntis {
  private readonly school: string;
  private readonly username: string;
  private readonly password: string;
  private readonly baseUrl: string;
  private readonly id: string;
  sessionInformation: SessionInformation | null = null;

  /**
   * @param school School identifier (e.g. "htl-leonding")
   * @param baseUrl Host name only (e.g. "htl-leonding.webuntis.com")
   * @param identity Client identity string sent to the API
   */
  constructor(
    school: string,
    username: string,
    password: string,
    baseUrl: string,
    identity = 'excuse-list',
  ) {
    this.school = school;
    this.username = username;
    this.password = password;
    this.baseUrl = `https://${baseUrl}`;
    this.id = identity;
  }

  private buildCookies(): string {
    if (!this.sessionInformation) {
      throw new UntisError('Not logged in');
    }
    const schoolBase64 = '_' + Buffer.from(this.school).toString('base64');
    return [
      `JSESSIONID=${encodeURIComponent(this.sessionInformation.sessionId)}`,
      `schoolname=${encodeURIComponent(schoolBase64)}`,
    ].join('; ');
  }

  private async rpc<T>(
    method: string,
    params: Record<string, unknown>,
    withSession: boolean,
  ): Promise<T> {
    const url = `${this.baseUrl}/WebUntis/jsonrpc.do?school=${encodeURIComponent(this.school)}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    };
    if (withSession) {
      headers['Cookie'] = this.buildCookies();
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ id: this.id, method, params, jsonrpc: '2.0' }),
    });

    if (!response.ok) {
      throw new UntisError(
        `WebUntis ${method} failed: HTTP ${response.status}`,
      );
    }

    let data: any;
    try {
      data = await response.json();
    } catch {
      throw new UntisError(`WebUntis ${method}: failed to parse response`);
    }

    if (data.error) {
      throw new UntisError(
        `WebUntis ${method} error: ${data.error.message || 'unknown'}`,
        data.error.code,
      );
    }
    if (data.result == null) {
      // Matches the original library's behavior: empty weeks (holidays) and
      // similar produce no result; callers treat this as "nothing here".
      throw new UntisError(`Server didn't return any result for ${method}.`);
    }
    if (typeof data.result === 'object' && data.result.code) {
      throw new UntisError(
        `WebUntis ${method} returned error code: ${data.result.code}`,
        data.result.code,
      );
    }
    return data.result as T;
  }

  // Runs an authenticated RPC; if the session expired, logs in again once.
  private async rpcWithSession<T>(
    method: string,
    params: Record<string, unknown>,
  ): Promise<T> {
    if (!this.sessionInformation) await this.login();
    try {
      return await this.rpc<T>(method, params, true);
    } catch (err) {
      if (err instanceof UntisError && err.code === NOT_AUTHENTICATED) {
        await this.login();
        return await this.rpc<T>(method, params, true);
      }
      throw err;
    }
  }

  async login(): Promise<SessionInformation> {
    const result = await this.rpc<SessionInformation>(
      'authenticate',
      { user: this.username, password: this.password, client: this.id },
      false,
    );
    if (!result.sessionId) {
      throw new UntisError('Failed to login. No session id.');
    }
    this.sessionInformation = result;
    return result;
  }

  async logout(): Promise<void> {
    if (!this.sessionInformation) return;
    try {
      await this.rpc('logout', {}, true);
    } finally {
      this.sessionInformation = null;
    }
  }

  async getOwnTimetableForRange(start: Date, end: Date): Promise<Lesson[]> {
    if (!this.sessionInformation) await this.login();
    const { personId, personType } = this.sessionInformation!;
    return this.rpcWithSession<Lesson[]>('getTimetable', {
      options: {
        id: Date.now(),
        element: { id: personId, type: personType },
        startDate: dateToUntis(start),
        endDate: dateToUntis(end),
        showLsText: true,
        showStudentgroup: true,
        showLsNumber: true,
        showSubstText: true,
        showInfo: true,
        showBooking: true,
        klasseFields: ['id', 'name', 'longname', 'externalkey'],
        roomFields: ['id', 'name', 'longname', 'externalkey'],
        subjectFields: ['id', 'name', 'longname', 'externalkey'],
        teacherFields: ['id', 'name', 'longname', 'externalkey'],
      },
    });
  }

  async getStudents(): Promise<Person[]> {
    return this.rpcWithSession<Person[]>('getStudents', {});
  }

  async getTeachers(): Promise<Person[]> {
    return this.rpcWithSession<Person[]>('getTeachers', {});
  }

  /**
   * Own absences (including excused ones) via the internal REST API.
   * Returns the `data` payload, whose `absences` array holds the lessons.
   */
  async getAbsentLesson(
    start: Date,
    end: Date,
    excuseStatusId = -1,
  ): Promise<AbsencesResult> {
    if (!this.sessionInformation) await this.login();
    const params = new URLSearchParams({
      startDate: String(dateToUntis(start)),
      endDate: String(dateToUntis(end)),
      studentId: String(this.sessionInformation!.personId),
      excuseStatusId: String(excuseStatusId),
    });
    const response = await fetch(
      `${this.baseUrl}/WebUntis/api/classreg/absences/students?${params}`,
      {
        headers: {
          Cookie: this.buildCookies(),
          'X-Requested-With': 'XMLHttpRequest',
        },
      },
    );
    if (!response.ok) {
      throw new UntisError(
        `WebUntis absences request failed: HTTP ${response.status}`,
      );
    }
    const data: any = await response.json();
    if (data?.data == null) {
      throw new UntisError('Server returned no absence data!');
    }
    return data.data as AbsencesResult;
  }
}
