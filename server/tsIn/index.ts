import { Center } from "./Center";

void Center.initialise().catch( error=>
{
    console.error( "Server failed to start:", error );

    process.exitCode = 1;
});