import { Library } from "./Library";
import { Center } from "./Center";
import { Tier, Tier$Level } from "./Tier";
import { Actor, Actor$Crew, Actor$Passenger } from "./Actor";

export type Resource$Aux = 
{ 
    id: Library.Identifier, 
    type: number, 
    status: Resource$Status, 
    name: string, 
    description: string, 
    minimumTier: Tier$Level 
};

export enum Resource$Status
{
    Inactive = 0,
    Active = 1
}

export class Resource
{
    public static readonly resourcesByMinimumTier: Map<Tier$Level, Set<Resource>> = new Map();

    private _id: Library.Identifier;
    private _type: number;
    private _status: Resource$Status;
    private _name: string;
    private _description: string;
    private _minimumTier: Tier;

    public static getById( id: Library.Identifier ): Resource | undefined
    {
        for( const resources of Resource.resourcesByMinimumTier.values() )
            for( const resource of resources )
                if( resource.id === id )
                    return resource;

        return undefined;
    }
    public static async create( caller: Actor, name: string, description: string, minimumTier: Tier ): Promise<Resource>
    {
        if( !(caller instanceof Actor$Crew) )
            throw new Library.Error( "Only crew members can create resources", Center.HttpServer.status.forbidden );

        const resource = new Resource( Library.getStringId(), 0, Resource$Status.Active, name.trim(), description.trim(), minimumTier );

        await Center.getMySqlClient().execute
        (
            "INSERT INTO Resource (id, type, status, name, description, minimumTier) VALUES (?, ?, ?, ?, ?, ?)",
            [resource.id, resource.type, resource.status, resource.name, resource.description, resource.minimumTier.level]
        );

        if( !Resource.resourcesByMinimumTier.has( minimumTier.level ) )
            Resource.resourcesByMinimumTier.set( minimumTier.level, new Set() );

        Resource.resourcesByMinimumTier.get( minimumTier.level )!.add( resource );

        return resource;
    }
    public static async initialise(): Promise<void>
    {
        const [rows]: any = await Center.getMySqlClient().execute
        (
            "SELECT id, type, status, name, description, minimumTier FROM Resource ORDER BY minimumTier, name, id",
            []
        );

        if( !Array.isArray( rows ) )
            throw new Library.Error( "Expected resource rows from the database", Center.HttpServer.status.internalError );

        const resourcesByMinimumTier: Map<Tier$Level, Set<Resource>> = new Map();

        (rows as Resource$Aux[]).map( row=>
        {
            const minimumTier: Tier | undefined = Tier.tiers.get( row.minimumTier as Tier$Level );
    
            if( !minimumTier )
                throw new Library.Error( `Unexpected resource tier: ${row.minimumTier}`, Center.HttpServer.status.internalError );

            if( row.status !== Resource$Status.Inactive && row.status !== Resource$Status.Active )
                throw new Library.Error( `Invalid resource status: ${row.status}`, Center.HttpServer.status.internalError );

            if( !resourcesByMinimumTier.has( minimumTier.level ) )
                resourcesByMinimumTier.set( minimumTier.level, new Set() );

            resourcesByMinimumTier.get( minimumTier.level )!.add( new Resource( row.id, row.type, row.status, row.name, row.description, minimumTier ) );
        });

        Resource.resourcesByMinimumTier.clear();

        for( const [level, resources] of resourcesByMinimumTier )
            Resource.resourcesByMinimumTier.set( level, resources );
    }

    public constructor( id: Library.Identifier, type: number, status: Resource$Status, name: string, description: string, minimumTier: Tier )
    {
        this._id = id;
        this._type = type;
        this._status = status;
        this._name = name;
        this._description = description;
        this._minimumTier = minimumTier;
    }
    public get id(): Library.Identifier
    {
        return this._id;
    }
    public get type(): number
    {
        return this._type;
    }
    public get status(): Resource$Status
    {
        return this._status;
    }
    public get name(): string
    {
        return this._name;
    }
    public get description(): string
    {
        return this._description;
    }
    public get minimumTier(): Tier
    {
        return this._minimumTier;
    }
    public async setStatus( caller: Actor, status: Resource$Status ): Promise<void>
    {
        if( !(caller instanceof Actor$Crew) )
            throw new Library.Error( "Only crew members can change resource status", Center.HttpServer.status.forbidden );

        if( status !== Resource$Status.Active && status !== Resource$Status.Inactive )
            throw new Library.Error( "Invalid resource status", Center.HttpServer.status.badRequest );

        await Center.getMySqlClient().execute
        (
            "UPDATE Resource SET status = ? WHERE id = ?",
            [status, this.id]
        );

        this._status = status;
    }
    public toAux( caller: Actor ): Resource$Aux
    {
        if( caller instanceof Actor$Passenger && this._status !== Resource$Status.Active )
            throw new Library.Error( "Resource is unavailable", Center.HttpServer.status.unauthorized );

        if( !caller.hasPermission( this ) )
            throw new Library.Error( "Caller does not have permission to access this resource", Center.HttpServer.status.unauthorized );

        return { 
            id: this._id, 
            type: this._type, 
            status: this._status, 
            name: this._name, 
            description: this._description, 
            minimumTier: this._minimumTier.level 
        };
    }
}