declare module 'melipayamak' {
  class RestAsync {
    send(to: string, from: string, text: string, isFlash?: boolean): Promise<{ Value?: string; RetStatus?: number; StrRetStatus?: string } | string | number>;
    sendByBaseNumber(text: string, to: string, bodyId: number | string): Promise<{ Value?: string; RetStatus?: number; StrRetStatus?: string } | string | number>;
    isDelivered(recId: number | string): Promise<unknown>;
    getMessages(location: number, index: number, count: number, from?: string): Promise<unknown>;
    getCredit(): Promise<unknown>;
    getBasePrice(): Promise<unknown>;
    getNumbers(): Promise<unknown>;
  }

  class MelipayamakApi {
    constructor(username?: string, password?: string);
    sms(method?: string, type?: string): RestAsync;
    branch(): unknown;
    branchAsync(): unknown;
    contacts(): unknown;
    contactsAsync(): unknown;
    ticket(): unknown;
    ticketAsync(): unknown;
    users(): unknown;
    usersAsync(): unknown;
  }

  export = MelipayamakApi;
}
