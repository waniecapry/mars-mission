import { resolve } from "node:path";
import dotenv from "dotenv";
import express, { type Express, type Request, type Response, type NextFunction, type RequestHandler } from "express";
import session from "express-session";
import cors from "cors";
import helmet from "helmet";

import { Library } from "./Library";
import { Actor, Actor$Aux, Actor$Crew, Actor$Passenger, Actor$Passenger$Aux, Actor$Role } from "./Actor";
import { Tier } from "./Tier";
import { Resource, Resource$Aux } from "./Resource";
import { handleRequests } from "./requests";

declare module "express-session"
{
    interface SessionData
    {
        userId?: Library.Identifier;
        userRole?: Actor$Role;
        isAuthenticated?: boolean;
    }
}

export namespace Center
{
    export type Aux = // Things to be returned to end user/client
    {
        actor: Actor$Aux;
        resources: Resource$Aux[];
        passengers?: Actor$Passenger$Aux[];
    };

    let _mysqlClient: Library.MySqlClient | null = null;
    let _server: HttpServer;

    export async function initialise(): Promise<void>
    {
        dotenv.config( { path: resolve( __dirname, "../data.env" ) } );

        const host: string | undefined = process.env.DB_HOST;
        const user: string | undefined = process.env.DB_USER;
        const database: string | undefined = process.env.DB_NAME;
    
        if( !host || !user || !database )
            throw new Library.Error( "DB_HOST, DB_USER, and DB_NAME must be configured" , Library.Error.status.internalError );

        const port: number = Number( process.env.DB_PORT ?? 3306 );
    
        if( !Number.isInteger( port ) || port < 1 || port > 65535 )
            throw new Library.Error( "DB_PORT must be a valid port" , Library.Error.status.internalError );

        const serverPort: number = Number( process.env.PORT );

        if( !Number.isInteger( serverPort ) || serverPort < 1 || serverPort > 65535 )
            throw new Library.Error( "PORT must be a valid port", Library.Error.status.internalError );

        const sessionSecret: string | undefined = process.env.SESSION_SECRET;

        if( !sessionSecret?.trim() )
            throw new Library.Error( "SESSION_SECRET must be configured", Library.Error.status.internalError );

        const sessionStorePort: number = Number( process.env.SESSION_STORE_PORT || port );

        if( !Number.isInteger( sessionStorePort ) || sessionStorePort < 1 || sessionStorePort > 65535 )
            throw new Library.Error( "SESSION_STORE_PORT must be a valid port", Library.Error.status.internalError );

        const options: HttpServer$Options =
        {
            port: serverPort,
            sessionSecret
        };

        const client: Library.MySqlClient = new Library.MySqlClient( host, user, process.env.DB_PASSWORD ?? "", database, port );
    
        await client.connect();

        _mysqlClient = client;

        await Tier.initialise();
        await Resource.initialise();
        await Actor.initialise();

        _server = new HttpServer
        (
            options,
            process.env.SESSION_STORE_HOST || host,
            sessionStorePort,
            process.env.SESSION_STORE_DATABASE || database,
            process.env.SESSION_STORE_USER || user,
            process.env.SESSION_STORE_PASS ?? process.env.DB_PASSWORD ?? ""
        );

        await _server.initialise( options.sessionSecret );

        const frontEndOrigin = process.env.FRONT_END_ORIGIN?.trim();

        if( frontEndOrigin )
            _server.app.use( cors( { origin: frontEndOrigin, credentials: true } ) );

        _server.app.use( (req: Request, res: Response, next: NextFunction) =>
        {
            if( req.path !== "/assets" && !req.path.startsWith( "/assets/" ) )
                res.setHeader( "Cache-Control", "no-store" );

            next();
        });
        _server.app.use( (req: Request, res: Response, next: NextFunction)=>
        {
            const path: string = req.path.toLowerCase();
            const isPrivateRoute: boolean = path === "/i" || path.startsWith( "/i/" ); // anything starts with i considered as private and need authorisation

            if( isPrivateRoute )
            {
                const isAuthenticatedSession: boolean = Center.isAuthenticatedSession( req );
            
                if( !isAuthenticatedSession )
                {
                    res.status( 401 ).json( { error: "Authentication required" } );

                    return;
                }
            }

            next();
        });
        handleRequests( _server.app );
        await _server.start();
    }
    export function getMySqlClient(): Library.MySqlClient
    {
        if( !_mysqlClient )
            throw new Library.Error( "MySQL client has not been initialised" , Library.Error.status.internalError );

        return _mysqlClient;
    }
    export function toAux( caller: Actor ): Aux
    {
        const resources: Resource$Aux[] = [];
        
        for( const resourceSet of Resource.resourcesByMinimumTier.values() )
            for( const resource of resourceSet )
                try{ resources.push( resource.toAux( caller ) ); }
                catch( ex )
                {
                    if( (ex as Library.Error).status === Library.Error.status.unauthorized )
                    {
                        // Ignore resources the caller is not authorized to access
                    }
                    else
                    {
                        throw ex;
                    }
                }

        return {
            actor: caller.toAux(),
            resources: resources
        };
    }
    export function isAuthenticatedSession( req: Request ): boolean
    {
        if( req.session.isAuthenticated && req.session.userId !== undefined )
        {
            if( req.session.userRole === Actor$Role.crew && Actor$Crew.members.has( req.session.userId ) )
                return true;

            if( req.session.userRole === Actor$Role.passenger && Actor$Passenger.members.has( req.session.userId ) )
                return true;
        }

        return false;
    }
    export function renderLoginView(): string
    {
        return "";
    }
    export function renderMainView( caller: Actor ): string
    {
        const aux: Aux = Center.toAux( caller );

        return "";
    }

    interface HttpServer$Options
    {
        port: number;
        sessionSecret: string;
    }

    export class HttpServer
    {
        private readonly _app: Express = express();
        private readonly _port: number;
        private _sessionMiddleware: RequestHandler;
        private _mysqlClientForSessionStore: Library.MySqlClient;
        private _initialised: boolean = false;
        private _endIintialised: boolean = false;

        public constructor( options: HttpServer$Options, sessionStoreHost: string, sessionStorePort: number, sessionStoreDatabase: string, sessionStoreUser: string, sessionStorePass: string ) 
        {
            this._port = options.port;
            this._mysqlClientForSessionStore = new Library.MySqlClient( sessionStoreHost, sessionStoreUser, sessionStorePass, sessionStoreDatabase, sessionStorePort );
        }
        public get app(): Express 
        {
            return this._app;
        }
        public start(): Promise<void>
        {
            if( !this._initialised )
                throw new Error( "HTTP server has not been initialised" );

            this.initEnd();

            return new Promise( (resolve, reject)=>
            {
                const server: any = this._app.listen( this._port );

                server.once( "listening", () =>
                {
                    console.log( `Server listening on port ${this._port}` );
                    resolve();
                });
                server.once( "error", reject );
            });
        }
        public async initialise( sessionSecret: string ): Promise<void>
        {
            if( this._initialised )
                return;

            await this._mysqlClientForSessionStore.connect();
    
            this._sessionMiddleware = session
            ({
                secret: sessionSecret,
                store: new HttpServer$SessionStore( this._mysqlClientForSessionStore ),
                resave: false,
                saveUninitialized: false,
                cookie:
                {
                    httpOnly: true,
                    secure: false,
                    maxAge: 1000 * 60 * 60
                }
            });
    
            this._app.disable( "x-powered-by" );
            this._app.use( helmet() );
            this._app.use( express.json( { limit: "10mb" } ) );
            this._app.use( express.urlencoded( { extended: true, limit: "10mb" } ) );
            this._app.use( this._sessionMiddleware );

            this._initialised = true;
        }
        private initEnd(): void
        {
            if( this._endIintialised )
                return;
    
            this._app.use( (req: Request, res: Response)=>
            {
                res.status( 404 ).json( { error: "Route not found" } );
            });
            this._app.use( (err: unknown, req: Request, res: Response, next: NextFunction)=>
            {
                if( res.headersSent )
                {
                    next( err );
        
                    return;
                }

                const error: any = err as Error & { code?: string, status?: number };
                const status: number = error.code === "ER_DUP_ENTRY" ? 409 : error instanceof Library.Error ? error.status : typeof error.status === "number" && error.status >= 400 && error.status < 500 ? error.status : 500;

                if( status >= 500 )
                    console.error( "Request failed:", req.ip, req.url, err );

                const message = status === 409 ? "The same data already exists" : status === 404 ? "Route not found" : status >= 500 ? "Internal server error" : error.message;
    
                res.status( status ).json( { error: message } );
            });

            this._endIintialised = true;
        }
    }
    export class HttpServer$SessionStore extends session.Store
    {
        private _mysqlClient: Library.MySqlClient;

        public constructor( mysqlClient: Library.MySqlClient )
        {
            super();

            this._mysqlClient = mysqlClient;
        }
        public override get( sid: string, cb: ( err: Error | null, data?: session.SessionData | null ) => void ): void
        {
            void (async ()=>
            {
                let data: session.SessionData | null;
            
                try
                {
                    const [rows]: any = await this._mysqlClient.execute
                    (
                        "SELECT data FROM `Session` WHERE id = ? AND expiresAt > ?",
                        [sid, Date.now()]
                    );
                    const stored = rows[0]?.data;
                
                    data = stored === undefined ? null : typeof stored === "string" ? JSON.parse( stored ) : stored;
                }
                catch( error )
                {
                    cb( error as Error );
        
                    return;
                }

                this.emit( "get", sid );
                cb( null, data );
            })();
        }
        public override set( sid: string, data: session.SessionData, cb?: ( err?: Error | null ) => void ): void
        {
            void (async () =>
            {
                try
                {
                    const expiresAt: Library.UnixTime = data.cookie.expires?.getTime() ?? Date.now() + (data.cookie.maxAge ?? 60 * 60 * 1000);
                    
                    await this._mysqlClient.execute
                    (
                        "INSERT INTO `Session` (id, data, expiresAt) VALUES (?, ?, ?) " +
                        "ON DUPLICATE KEY UPDATE data = VALUES(data), expiresAt = VALUES(expiresAt)",
                        [sid, JSON.stringify( data ), expiresAt]
                    );
                    this.emit( "set", sid );
                    cb?.( null );
                }
                catch( error )
                {
                    if( cb ) 
                        cb( error as Error );
        
                    else console.error( "Unable to save session", error );
                }
            })();
        }
        public override touch( sid: string, data: session.SessionData, cb?: ( err?: Error | null ) => void ): void
        {
            void (async ()=>
            {
                try
                {
                    const expiresAt: Library.UnixTime = data.cookie.expires?.getTime() ?? Date.now() + (data.cookie.maxAge ?? 60 * 60 * 1000);

                    await this._mysqlClient.execute
                    (
                        "UPDATE `Session` SET expiresAt = ? WHERE id = ?",
                        [expiresAt, sid]
                    );
                    cb?.( null );
                }
                catch( error )
                {
                    if( cb )
                        cb( error as Error );

                    else console.error( "Unable to refresh session", error );
                }
            })();
        }
        public override destroy( sid: string, cb?: ( err?: Error | null ) => void ): void
        {
            void (async ()=>
            {
                try
                {
                    await this._mysqlClient.execute
                    (
                        "DELETE FROM `Session` WHERE id = ?",
                        [sid]
                    );
                    this.emit( "destroy", sid );
                    cb?.( null );
                }
                catch( error )
                {
                    if( cb ) 
                        cb( error as Error );

                    else console.error( "Unable to destroy session", error );
                }
            })();
        }
    }
}
