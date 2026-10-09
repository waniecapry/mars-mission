export function tierName( tier?: number ): string
{
    return tier === 1 ? "Silver" : tier === 2 ? "Gold" : tier === 3 ? "Platinum" : "Unassigned";
}

export function outcomeName( outcome: number ): string
{
    return outcome === 1 ? "Granted" : outcome === 2 ? "Unavailable" : "Denied";
}

export function dateTime( timestamp: number ): string
{
    return new Intl.DateTimeFormat( undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" } ).format( new Date( Number( timestamp ) ) );
}

export function initials( name?: string ): string
{
    return (name || "X26").split( /\s+/ ).slice( 0, 2 ).map( part=>part[0]?.toUpperCase() || "" ).join( "" );
}