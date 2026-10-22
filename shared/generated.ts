// Generated from Rust. Run cargo test export_mobile_contract.
export type BrokerConfiguration = { issuer: string, organizationId: string, projectId: string, iosClientId: string, androidClientId: string, googleIdpId: string, facebookIdpId: string, appleIdpId: string, };
export type PublishingCapabilities = { facebook: boolean, instagram: boolean, whatsapp: boolean, };
export type Capabilities = { google: boolean, facebook: boolean, apple: boolean, auth: BrokerConfiguration, publishing: PublishingCapabilities, };
export type Category = "waste" | "pollution" | "roads" | "water" | "public_safety";
export type Channel = "facebook" | "instagram" | "whatsapp";
export type Location = { latitude: number, longitude: number, countryCode: string, locality: string, };
export type ReportInput = { category: Category, description: string, location: Location, photoBase64: string, channels: Array<Channel>, consent: boolean, };
export type User = { id: string, nickname: string, };
export type Session = { token: string, user: User, expiresAt: string, };
export type LoginInput = { token: string, challengeId: string, nickname: string | null, };
export type Challenge = { id: string, nonce: string, };
export type PublicationStatus = "queued" | "sending" | "published" | "blocked" | "failed" | "uncertain";
export type Publication = { channel: Channel, status: PublicationStatus, providerId: string | null, reason: string | null, };
export type Routing = { status: string, authorityNames: Array<string>, };
export type Report = { id: string, nickname: string, category: Category, description: string, location: Location, createdAt: string, status: string, routing: Routing, publications: Array<Publication>, };
export type Approval = { publicDescription: string, publicLocality: string, photoPrivacyReviewed: boolean, includeParents: boolean, };
export type DeletionRequest = { id: string, status: string, requestedAt: string, dueAt: string, owner: string, };
