import { Library } from "./Library";
import { Center } from "./Center";
import { Resource, Resource$Status, Resource$Aux } from "./Resource";

export enum Tier$Level
{
    Silver = 1,
    Gold = 2,
    Platinum = 3
}

export class Tier
{
    public static readonly tiers: Map<Tier$Level, Tier> = new Map();

    private _level: Tier$Level;
    private _resources: Resource[] = [];

    public static async initialise( client: Library.MySqlClient = Center.getMySqlClient() ): Promise<void>
    {
        const [rows]: any = await client.execute
        (
            "SELECT id, type, status, name, description, minimumTier FROM Resource ORDER BY minimumTier, name, id",
            []
        );

        if( !Array.isArray( rows ) )
            throw new Library.Error( "Expected resource rows from the database", Library.Error.status.internalError );

        Tier.tiers.set( Tier$Level.Silver, new Tier( Tier$Level.Silver ) );
        Tier.tiers.set( Tier$Level.Gold, new Tier( Tier$Level.Gold ) );
        Tier.tiers.set( Tier$Level.Platinum, new Tier( Tier$Level.Platinum ) );
    
        const resources = (rows as Resource$Aux[]).map( row=>
        {
            const minimumTier: Tier | undefined = Tier.tiers.get( row.minimumTier as Tier$Level );
    
            if( !minimumTier )
                throw new Library.Error( `Unexpected resource tier: ${row.minimumTier}`, Library.Error.status.internalError );

            if( row.status !== Resource$Status.Inactive && row.status !== Resource$Status.Active )
                throw new Library.Error( `Invalid resource status: ${row.status}`, Library.Error.status.internalError );

            return new Resource( row.id, row.type, row.status, row.name, row.description, minimumTier );
        });

        for( const tier of Tier.tiers.values() )
            tier.setResources( resources.filter( resource=>resource.minimumTier.level <= tier.level ) );
    }

    public constructor( level: Tier$Level )
    {
        this._level = level;
    }
    public get level(): Tier$Level
    {
        return this._level;
    }
    public getResources(): Resource[]
    {
        return [...this._resources];
    }
    public canAccessResource( resource: Resource ): boolean
    {
        return resource.minimumTier.level <= this.level;
    }
    public toAux(): Tier$Level
    {
        return this._level;
    }
    private setResources( resources: Resource[] ): void
    {
        this._resources = resources;
    }
}