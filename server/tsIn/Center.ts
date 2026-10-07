import { resolve } from "node:path";
import dotenv from "dotenv";
import express, { type Express, type Request, type Response, type NextFunction, type RequestHandler } from "express";
import session from "express-session";
import cors from "cors";
import helmet from "helmet";

import { Library } from "./Library";
import { Actor, Actor$Aux, Actor$Crew, Actor$Passenger, Actor$Passenger$Aux } from "./Actor";
import { Tier } from "./Tier";
import { Resource, Resource$Aux } from "./Resource";
import { handleRequests } from "./requests";

declare module "express-session"
{
    interface SessionData
    {
        userId?: Library.Identifier;
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

        const port = Number( process.env.DB_PORT ?? 3306 );
    
        if( !Number.isInteger( port ) || port < 1 || port > 65535 )
            throw new Library.Error( "DB_PORT must be a valid port" , Library.Error.status.internalError );

        const client: Library.MySqlClient = new Library.MySqlClient( host, user, process.env.DB_PASSWORD ?? "", database, port );
    
        await client.connect();

        _mysqlClient = client;

        await Tier.initialise();
        await Resource.initialise();
        await Actor.initialise();

        const options: HttpServer$Options =
        {
            port: parseInt( process.env.PORT as string ),
            sessionSecret: process.env.SESSION_SECRET as string,
            frontEndOrigin: process.env.FRONT_END_ORIGIN as string
        };
    
        _server = new HttpServer
        (
            options,
            process.env.SESSION_STORE_HOST as string,
            parseInt( process.env.SESSION_STORE_PORT as string ),
            process.env.SESSION_STORE_DATABASE as string,
            process.env.SESSION_STORE_USER as string,
            process.env.SESSION_STORE_PASS as string
        );

        await _server.initialise( options.sessionSecret, options.frontEndOrigin );

        _server.app.use( async(req: Request, res: Response, next: NextFunction )=>
        {                           console.log( "it come here,", req.session );
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
        _server.start();
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
                {                                   console.error( ex );
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
        return req.session.isAuthenticated === true && req.session.userId !== undefined && (Actor$Crew.members.has( req.session.userId ) || Actor$Passenger.members.has( req.session.userId ));
    }

    interface HttpServer$Options 
    {
        port: number;
        sessionSecret: string;
        frontEndOrigin: string;
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
        public start(): void 
        {
            if( !this._initialised )
                throw new Error( "HTTP server has not been initialised" );

            this.initEnd();
            this._app.listen( this._port, () => 
            {
                console.log( `Server listening on port ${this._port}` );
            });
        }
        public async initialise( sessionSecret: string, frontEndOrigin: string ): Promise<void>
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
            this._app.use
            (
                cors
                ({
                    origin: frontEndOrigin,
                    credentials: true
                })
            );
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
    
            this._app.use( (req: Request, res: Response, next: NextFunction)=>
            {
                res.status( 404 );

                res.send( `` );
            });
            // https://expressjs.com/en/guide/error-handling.html
            this._app.use( ( err: any, req: Request, res: Response, next: NextFunction )=> 
            {       
                console.error( "Error occured:", req.ip, req.url, err );

                if( !err )
                    return next();

                if( res.statusCode == 200 )
                    res.status( 500 );

                res.send( `` );
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
        public get( sid: string, cb: ( err: Error | null, data?: session.SessionData | null ) => void ): void
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
        public set( sid: string, data: session.SessionData, cb?: ( err?: Error | null ) => void ): void
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
        public destroy( sid: string, cb?: ( err?: Error | null ) => void ): void
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