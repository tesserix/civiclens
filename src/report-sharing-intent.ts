let pending: {token:string;reportId:string}|null=null;

export function beginReportSharing(token:string,reportId:string) {
  pending={token,reportId};
}

export function consumeReportSharing(token:string,reportId:string):boolean {
  const intent=pending;
  pending=null;
  return !!intent && intent.token===token && intent.reportId===reportId;
}
