import { Library } from "./Library";
import { Center } from "./Center";
import { Tier, Tier$Level } from "./Tier";
import { Actor } from "./Actor";

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

    public static async initialise(): Promise<void>
    {
        const [rows]: any = await Center.getMySqlClient().execute
        (
            "SELECT id, type, status, name, description, minimumTier FROM Resource ORDER BY minimumTier, name, id",
            []
        );

        if( !Array.isArray( rows ) )
            throw new Library.Error( "Expected resource rows from the database", Library.Error.status.internalError );

        (rows as Resource$Aux[]).map( row=>
        {
            const minimumTier: Tier | undefined = Tier.tiers.get( row.minimumTier as Tier$Level );
    
            if( !minimumTier )
                throw new Library.Error( `Unexpected resource tier: ${row.minimumTier}`, Library.Error.status.internalError );

            if( row.status !== Resource$Status.Inactive && row.status !== Resource$Status.Active )
                throw new Library.Error( `Invalid resource status: ${row.status}`, Library.Error.status.internalError );

            if( !Resource.resourcesByMinimumTier.has( minimumTier.level ) )
                Resource.resourcesByMinimumTier.set( minimumTier.level, new Set() );

            Resource.resourcesByMinimumTier.get( minimumTier.level )!.add( new Resource( row.id, row.type, row.status, row.name, row.description, minimumTier ) );
        });
    }

    private _id: Library.Identifier;
    private _type: number;
    private _status: Resource$Status;
    private _name: string;
    private _description: string;
    private _minimumTier: Tier;

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
    public toAux( caller: Actor ): Resource$Aux
    {
        if( !caller.hasPermission( this ) )
            throw new Library.Error( "Caller does not have permission to access this resource", Library.Error.status.unauthorized );

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