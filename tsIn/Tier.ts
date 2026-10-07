import { Center } from "./Center";
import { Resource, Resource$Aux, Resource$Status } from "./Resource";

export enum Tier$Level
{
    Silver = 1,
    Gold = 2,
    Platinum = 3
}

export abstract class Tier
{
    public static readonly tiers: Map<Tier$Level, Tier> = new Map();

    protected _resources: Resource[] = [];

    public static async initialise(): Promise<void>
    {
        Tier.tiers.set( Tier$Level.Silver, new Tier$Silver() );
        Tier.tiers.set( Tier$Level.Gold, new Tier$Gold() );
        Tier.tiers.set( Tier$Level.Platinum, new Tier$Platinum() );

        for( const tier of Tier.tiers.values() )
        {
            await tier.initialise();
        }
    }

    public abstract get level(): Tier$Level;
    public abstract initialise(): Promise<void>;
    public getResources(): Resource[]
    {
        return [...this._resources];
    }
    public canAccessResource( resource: Resource ): boolean
    {
        return resource.minimumTier.level <= this.level;
    }
    protected async loadResources(): Promise<Resource[]>
    {
        const [rows] = await Center.getMySqlClient().execute
        (
            "SELECT id, type, status, name, description, minimumTier FROM Resource WHERE minimumTier = ? ORDER BY name, id",
            [this.level]
        );
    
        if( !Array.isArray( rows ) )
            throw new TypeError( "Expected resource rows from the database" );

        return (rows as Resource$Aux[]).map( row=>
        {
            if( row.minimumTier !== this.level )
                throw new RangeError( `Unexpected resource tier: ${row.minimumTier}` );
        
            if( row.status !== Resource$Status.Inactive && row.status !== Resource$Status.Active )
                throw new RangeError( `Invalid resource status: ${row.status}` );

            return new Resource( row.id, row.type, row.status, row.name, row.description, this );
        });
    }
}
export class Tier$Silver extends Tier
{
    public get level(): Tier$Level
    {
        return Tier$Level.Silver;
    }
    public override async initialise(): Promise<void>
    {
        this._resources = await this.loadResources();
    }
}
export class Tier$Gold extends Tier$Silver
{
    public override get level(): Tier$Level
    {
        return Tier$Level.Gold;
    }
    public override async initialise(): Promise<void>
    {
        await super.initialise();
    
        const goldResources: Resource[] = await this.loadResources();
        this._resources = [...this._resources, ...goldResources];
    }
}
export class Tier$Platinum extends Tier$Gold
{
    public override get level(): Tier$Level
    {
        return Tier$Level.Platinum;
    }
    public override async initialise(): Promise<void>
    {
        await super.initialise();
    
        const platinumResources: Resource[] = await this.loadResources();
        this._resources = [...this._resources, ...platinumResources];
    }
}