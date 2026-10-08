import { randomBytes } from "crypto";
import { Library } from "./Library";
import { Center } from "./Center";
import type { Resource } from "./Resource";
import { Tier, Tier$Level } from "./Tier";

export type Actor$Aux = { id: Library.Identifier, role: Actor$Role, name: string, email: string };
export type Actor$AuxDb = Actor$Aux & { salt: string, password: string };
export type Actor$Passenger$Aux = Actor$Aux & { tier: Tier$Level };
export type Actor$Passenger$AuxDb = Actor$AuxDb & { tier: Tier$Level };

export enum Actor$Role
{
    crew,
    passenger
}

export abstract class Actor
{
    private static _pendingCrewCreations: number = 0;

    private _id: Library.Identifier;
    private _name: string;
    private _role: Actor$Role;
    private _email: string;
    private _password: string;
    private _salt: string;

    public static async initialise(): Promise<void>
    {
        const [rows]: any = await Center.getMySqlClient().execute( "SELECT Actor.*, Actor$Passenger.tier FROM Actor LEFT JOIN Actor$Passenger ON Actor$Passenger.id = Actor.id", [] );
        const crewMembers: Map<Library.Identifier, Actor$Crew> = new Map();
        const passengerMembers: Map<Library.Identifier, Actor$Passenger> = new Map();

        rows.map( (row: Actor$AuxDb): void=>
        {
            if( row.role === Actor$Role.crew )
            {
                if( crewMembers.size >= 3 )
                    throw new Library.Error( "Cannot have more than 3 crew members", Center.HttpServer.status.internalError );
        
                crewMembers.set( row.id, new Actor$Crew( row.id, row.name, row.email, row.salt, row.password ) );
            }
            else if( row.role === Actor$Role.passenger )
            {
                const tier: Tier | undefined = Tier.tiers.get( (row as Actor$Passenger$AuxDb).tier );
            
                if( !tier )
                    throw new Library.Error( "Passenger has invalid tier", Center.HttpServer.status.internalError );
        
                passengerMembers.set( row.id, new Actor$Passenger( row.id, row.name, row.email, row.salt, row.password, tier ) );
            }
            else throw new Library.Error( "Actor has invalid role", Center.HttpServer.status.internalError );
        });

        if( crewMembers.size !== 3 )
            throw new Library.Error( "Exactly 3 crew members are required", Center.HttpServer.status.internalError );

        Actor$Crew.members.clear();
        Actor$Passenger.members.clear();

        for( const [id, member] of crewMembers )
            Actor$Crew.members.set( id, member );

        for( const [id, member] of passengerMembers )
            Actor$Passenger.members.set( id, member );
    }
    public static async create( caller: Actor$Crew,role: Actor$Role, name: string, email: string, password: string, tier?: Tier ): Promise<Actor>
    {
        if( !(caller instanceof Actor$Crew) )
            throw new Library.Error( "Only crew members can create other actors", Center.HttpServer.status.unauthorized );
        
        const normalizedEmail: string = email.toLowerCase().trim();
    
        if( !Library.EMAIL_REGEX.test( normalizedEmail ) )
            throw new Library.Error( "Invalid email address", Center.HttpServer.status.internalError );

        if( role === Actor$Role.passenger )
        {
            if( !tier )
                throw new Library.Error( "Passenger must have a tier", Center.HttpServer.status.internalError );

            const salt: string = randomBytes( 16 ).toString( "hex" );
            const pass: string = Library.makeHash( password.trim(), salt );
            const passengerAux: Actor$Passenger$Aux = { id: Library.getStringId(), role, name: name.trim(), email: normalizedEmail, tier: tier.level };

            await Center.getMySqlClient().withTransaction( async connection=>
            {
                await connection.execute
                (
                    "INSERT INTO Actor (id, role, name, email, salt, password) VALUES (?, ?, ?, ?, ?, ?)",
                    [passengerAux.id, passengerAux.role, passengerAux.name, normalizedEmail, salt, pass ]
                );
                await connection.execute
                (
                    "INSERT INTO Actor$Passenger (id, tier) VALUES (?, ?)",
                    [passengerAux.id, passengerAux.tier]
                );
            });

            Actor$Passenger.members.set( passengerAux.id, new Actor$Passenger( passengerAux.id, passengerAux.name, normalizedEmail, salt, pass, tier ) );
        
            return Actor$Passenger.members.get( passengerAux.id )!;
        }
        else if( role === Actor$Role.crew )
        {
            if( Actor$Crew.members.size + Actor._pendingCrewCreations >= 3 )
                throw new Library.Error( "Cannot create more than 3 crew members", Center.HttpServer.status.internalError );

            ++Actor._pendingCrewCreations; // Increment pending crew creations to prevent race conditions

            try
            {
                const salt: string = randomBytes( 16 ).toString( "hex" );
                const pass: string = Library.makeHash( password.trim(), salt );
                const crewAux: Actor$Aux = { id: Library.getStringId(), role, name: name.trim(), email: normalizedEmail };

                await Center.getMySqlClient().execute
                (
                    "INSERT INTO Actor (id, role, name, email, salt, password) VALUES (?, ?, ?, ?, ?, ?)",
                    [crewAux.id, crewAux.role, crewAux.name, normalizedEmail, salt, pass ]
                );

                Actor$Crew.members.set( crewAux.id, new Actor$Crew( crewAux.id, crewAux.name, normalizedEmail, salt, pass ) );

                return Actor$Crew.members.get( crewAux.id )!;
            }
            finally
            {
                --Actor._pendingCrewCreations;
            }
        }

        throw new Library.Error( "Invalid role", Center.HttpServer.status.internalError );
    }
    public static getByEmail( email: string ): Actor | undefined
    {
        const members: Actor[] = [...Actor$Crew.members.values(), ...Actor$Passenger.members.values()];

        for( const a of members )
            if( email === a.email )
                return a;

        return undefined;
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
    public abstract hasPermission( resource: Resource ): boolean;
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
    public static readonly members: Map<Library.Identifier, Actor$Passenger> = new Map();

    private _tier: Tier;

    public constructor( id: Library.Identifier, name: string, email: string, salt: string, password: string, tier: Tier )
    {
        super( id, name, Actor$Role.passenger, email, salt, password );

        this._tier = tier;
    }
    public get tier(): Tier
    {
        return this._tier;
    }
    public override toAux(): Actor$Passenger$Aux
    {
        return { 
            ...super.toAux(),
            tier: this._tier.level
        };
    }
    public override hasPermission( resource: Resource ): boolean
    {
        return this._tier.canAccessResource( resource );
    }
    public async setTier( caller: Actor, tier: Tier ): Promise<void>
    {
        if( !(caller instanceof Actor$Crew) )
            throw new Library.Error( "Only crew members can set passenger tiers", Center.HttpServer.status.unauthorized );

        await Center.getMySqlClient().execute
        (
            "UPDATE Actor$Passenger SET tier = ? WHERE id = ?;",
            [tier.level, this.id]
        );

        this._tier = tier;
    }
}
export class Actor$Crew extends Actor
{
    public static readonly members: Map<Library.Identifier, Actor$Crew> = new Map();

    public constructor( id: Library.Identifier, name: string, email: string, salt: string, password: string )
    {
        super( id, name, Actor$Role.crew, email, salt, password );
    }
    public override hasPermission( resource: Resource ): boolean
    {
        return true;
    }
}