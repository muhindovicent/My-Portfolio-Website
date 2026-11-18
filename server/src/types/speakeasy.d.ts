declare module 'speakeasy' {
  export function generateSecret(opts?: { length?: number }): { base32: string };
  export function otpauthURL(opts: {
    secret: string;
    label: string;
    issuer: string;
  }): string;
  export namespace totp {
    export function verifyDelta(opts:{secret:string;encoding:'base32';token:string;time:number;window:number}):{delta:number}|undefined;
    export function verify(opts: {
      secret: string;
      encoding: 'base32';
      token: string;
      window?: number;
    }): boolean;
  }
}
