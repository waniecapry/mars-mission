import { Library } from "./Library";
import { Center } from "./Center";
import { Actor, Actor$Crew, Actor$Passenger } from "./Actor";
import { Resource, Resource$Status } from "./Resource";
import { Tier$Level } from "./Tier";

export type Resource$Usage$Aux =
{
    id: Library.Identifier;
    passengerId: Library.Identifier;
    resourceId: Library.Identifier;
    resourceName: string;
    tierAtUse: Tier$Level;
    outcome: Resource$Usage$Outcome;
    occurredAt: Library.UnixTime;
};
export type Resource$Usage$Activity$Aux = Resource$Usage$Aux & { passengerName: string };
export type Resource$Usage$Report =
{
    byTier: { tier: Tier$Level, usageCount: number, resources: { resourceId: Library.Identifier, resourceName: string, usageCount: number }[] }[];
    popularResources: { resourceId: Library.Identifier, resourceName: string, usageCount: number }[];
};

export enum Resource$Usage$Outcome
{
    Denied = 0,
    Granted = 1,
    Unavailable = 2
}

export class Resource$Usage
{
    public static async record( caller: Actor, resource: Resource ): Promise<Resource$Usage$Aux>
    {
        if( !(caller instanceof Actor$Passenger) )
            throw new Library.Error( "Only passengers can use resources", Center.HttpServer.status.forbidden );

        const outcome: Resource$Usage$Outcome = !caller.hasPermission( resource ) ? Resource$Usage$Outcome.Denied : resource.status !== Resource$Status.Active ? Resource$Usage$Outcome.Unavailable : Resource$Usage$Outcome.Granted;
        const usage: Resource$Usage$Aux =
        {
            id: Library.getStringId(),
            passengerId: caller.id,
            resourceId: resource.id,
            resourceName: resource.name,
            tierAtUse: caller.tier.level,
            outcome,
            occurredAt: Date.now()
        };

        await Center.getMySqlClient().execute
        (
            "INSERT INTO Resource$Usage (id, passengerId, resourceId, tierAtUse, outcome, occurredAt) VALUES (?, ?, ?, ?, ?, ?)",
            [usage.id, usage.passengerId, usage.resourceId, usage.tierAtUse, usage.outcome, usage.occurredAt]
        );

        return usage;
    }
    public static async getHistory( caller: Actor, passenger: Actor$Passenger ): Promise<Resource$Usage$Aux[]>
    {
        if( !(caller instanceof Actor$Crew) && caller.id !== passenger.id )
            throw new Library.Error( "Cannot view another passenger's usage", Center.HttpServer.status.forbidden );

        const [rows]: any = await Center.getMySqlClient().execute
        (
            "SELECT Resource$Usage.id, passengerId, resourceId, Resource.name AS resourceName, tierAtUse, outcome, occurredAt " +
            "FROM Resource$Usage JOIN Resource ON Resource.id = Resource$Usage.resourceId " +
            "WHERE passengerId = ? ORDER BY occurredAt DESC, Resource$Usage.id DESC",
            [passenger.id]
        );

        return rows as Resource$Usage$Aux[];
    }
    public static async getActivity( caller: Actor ): Promise<Resource$Usage$Activity$Aux[]>
    {
        if( !(caller instanceof Actor$Crew) )
            throw new Library.Error( "Only crew members can view ship activity", Center.HttpServer.status.forbidden );

        const [rows]: any = await Center.getMySqlClient().execute
        (
            "SELECT Resource$Usage.id, passengerId, Actor.name AS passengerName, resourceId, " +
            "Resource.name AS resourceName, tierAtUse, outcome, occurredAt " +
            "FROM Resource$Usage JOIN Resource ON Resource.id = Resource$Usage.resourceId " +
            "JOIN Actor ON Actor.id = Resource$Usage.passengerId " +
            "ORDER BY occurredAt DESC, Resource$Usage.id DESC LIMIT 100",
            []
        );

        return rows as Resource$Usage$Activity$Aux[];
    }
    public static async getReport( caller: Actor ): Promise<Resource$Usage$Report>
    {
        if( !(caller instanceof Actor$Crew) )
            throw new Library.Error( "Only crew members can view usage reports", Center.HttpServer.status.forbidden );

        const [tierRows]: any = await Center.getMySqlClient().execute
        (
            "SELECT tierAtUse AS tier, COUNT(*) AS usageCount FROM Resource$Usage " +
            "WHERE outcome = ? GROUP BY tierAtUse ORDER BY tierAtUse",
            [Resource$Usage$Outcome.Granted]
        );
        const [resourceRows]: any = await Center.getMySqlClient().execute
        (
            "SELECT Resource.id AS resourceId, Resource.name AS resourceName, COUNT(*) AS usageCount " +
            "FROM Resource$Usage JOIN Resource ON Resource.id = Resource$Usage.resourceId " +
            "WHERE outcome = ? GROUP BY Resource.id, Resource.name ORDER BY usageCount DESC, Resource.name",
            [Resource$Usage$Outcome.Granted]
        );
        const [tierResourceRows]: any = await Center.getMySqlClient().execute
        (
            "SELECT tierAtUse AS tier, Resource.id AS resourceId, Resource.name AS resourceName, COUNT(*) AS usageCount " +
            "FROM Resource$Usage JOIN Resource ON Resource.id = Resource$Usage.resourceId " +
            "WHERE outcome = ? GROUP BY tierAtUse, Resource.id, Resource.name " +
            "ORDER BY tierAtUse, usageCount DESC, Resource.name",
            [Resource$Usage$Outcome.Granted]
        );

        return {
            byTier: [Tier$Level.Silver, Tier$Level.Gold, Tier$Level.Platinum].map( tier=>
            ({
                tier,
                usageCount: Number( tierRows.find( (row: { tier: number })=>row.tier === tier )?.usageCount ?? 0 ),
                resources: tierResourceRows.filter( (row: { tier: number })=>row.tier === tier ).map
                ( (row: { resourceId: string, resourceName: string, usageCount: number | string })=>
                ({
                    resourceId: row.resourceId,
                    resourceName: row.resourceName,
                    usageCount: Number( row.usageCount )
                }) )
            }) ),
            popularResources: resourceRows.map( (row: { resourceId: string, resourceName: string, usageCount: number | string })=>
            ({
                resourceId: row.resourceId,
                resourceName: row.resourceName,
                usageCount: Number( row.usageCount )
            }) )
        };
    }
}