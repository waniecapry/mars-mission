import type { Library } from "./Library";
import type { Tier, Tier$Level } from "./Tier";

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
    public toAux(): Resource$Aux
    {
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