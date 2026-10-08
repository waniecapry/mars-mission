import { type Application, type Request, type Response } from "express";
import { Library } from "./Library";
import { Center } from "./Center";
import { Actor, Actor$Crew, Actor$Passenger } from "./Actor";

export function handleRequests( app: Application ): void
{
    app.get( "/", ( req: Request, res: Response ) =>
    {
        const userId: Library.Identifier | undefined = req.session.userId;

        if( Center.isAuthenticatedSession( req ) && userId !== undefined )
        {
            const caller: Actor | undefined = Actor$Crew.members.get( userId ) ?? Actor$Passenger.members.get( userId );

            if( caller )
            {
                res.send( Center.renderMainView( caller ) );

                return;
            }
        }

        res.send( Center.renderLoginView() );
    });

}