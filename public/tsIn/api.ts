export type TierLevel = 1 | 2 | 3;
export type ActorRole = 0 | 1;
export type Actor =
{
    id: string;
    role: ActorRole;
    name: string;
    email: string;
    tier?: TierLevel;
};
export type Resource =
{
    id: string;
    type: number;
    status: 0 | 1;
    name: string;
    description: string;
    minimumTier: TierLevel;
};
export type Session =
{
    actor: Actor;
    resources: Resource[];
};
export type Resource$Usage =
{
    id: string;
    passengerId: string;
    passengerName?: string;
    resourceId: string;
    resourceName: string;
    tierAtUse: TierLevel;
    outcome: 0 | 1 | 2;
    occurredAt: number;
};
export type Resource$Usage$Count = { resourceId: string, resourceName: string, usageCount: number };
export type Resource$Usage$Report =
{
    byTier: { tier: TierLevel, usageCount: number, resources: Resource$Usage$Count[] }[];
    popularResources: Resource$Usage$Count[];
};

export async function api<T>( path: string, method: string = "GET", body?: unknown ): Promise<T>
{
    const response = await fetch
    (
        path,
        {
            method,
            credentials: "same-origin",
            headers: body === undefined ? undefined : { "Content-Type": "application/json" },
            body: body === undefined ? undefined : JSON.stringify( body )
        }
    );
    const text = response.status === 204 ? "" : await response.text();
    const data = text ? JSON.parse( text ) : undefined;

    if( !response.ok )
        throw new ApiError( response.status, data?.error || `Request failed (${response.status})` );

    return data as T;
}

export class ApiError extends Error
{
    public constructor( public readonly status: number, message: string )
    {
        super( message );
    }
}