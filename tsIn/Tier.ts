import { Library } from "./Library";
import { Center } from "./Center";
import { Resource } from "./Resource";

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
    private _resources: Resource[];

    public static async initialise( client: Library.MySqlClient = Center.getMySqlClient() ): Promise<void>
    {
        Tier.tiers.set( Tier$Level.Silver, new Tier( Tier$Level.Silver ) );
        Tier.tiers.set( Tier$Level.Gold, new Tier( Tier$Level.Gold ) );
        Tier.tiers.set( Tier$Level.Platinum, new Tier( Tier$Level.Platinum ) );
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
        if( this._resources.length > 0 )
            return this._resources;

        for( let i = Tier$Level.Silver; i <= this.level; ++i )
        {
            const tierResources: Set<Resource> | undefined = Resource.resourcesByMinimumTier.get( i );
    
            if( tierResources )
                this._resources.push( ...tierResources );
        }

        return this._resources;
    }
    public canAccessResource( resource: Resource ): boolean
    {
        return resource.minimumTier.level <= this.level;
    }
    public toAux(): Tier$Level
    {
        return this._level;
    }
}