import { Library } from "./Library";

export type Actor$Aux = { id: Library.Identifier, role: Actor$Role, name: string, email: string };
export type Actor$Passenger$Aux = Actor$Aux & { tier: number };

export enum Actor$Role
{
    crew,
    passenger
}

export abstract class Actor
{
    private _id: Library.Identifier;
    private _name: string;
    private _role: Actor$Role;
    private _email: string;
    private _password: string;
    private _salt: string;

    public static async initialise(): Promise<void>
    {
        // No initialisation required for now.
    }
    public static async create( role: Actor$Role, name: string, email: string, password: string, tier?: number ): Promise<void>
    {
        // Will be implemented later.
    }

    public constructor( id: Library.Identifier, name: string, role: Actor$Role, email: string, salt: string, password: string )
    {
        this._id = id;
        this._name = name;
        this._role = role;
        this._email = email;
        this._salt = salt;
        this._password = password;
    }
    public get id(): Library.Identifier
    {
        return this._id;
    }
    public get name(): string
    {
        return this._name;
    }
    public get role(): Actor$Role
    {
        return this._role;
    }
    public get email(): string
    {
        return this._email;
    }
    public isValidPassword( password: string ): boolean
    {
        return Library.isHashValueCorrect( password, this._salt, this._password );
    }
    public toAux(): Actor$Aux
    {
        return { 
            id: this._id, 
            role: this._role, 
            name: this._name, 
            email: this._email 
        };
    }
}
export class Actor$Passenger extends Actor
{
    private _tier: number; // Will make a class for the tier instead.

    public constructor( id: Library.Identifier, name: string, email: string, salt: string, password: string, tier: number )
    {
        super( id, name, Actor$Role.passenger, email, salt, password );

        this._tier = tier;
    }
    public get tier(): number
    {
        return this._tier;
    }
    public override toAux(): Actor$Passenger$Aux
    {
        return { 
            ...super.toAux(),
            tier: this._tier
        };
    }
}
export class Actor$Crew extends Actor
{
    public constructor( id: Library.Identifier, name: string, email: string, salt: string, password: string )
    {
        super( id, name, Actor$Role.crew, email, salt, password );
    }
}