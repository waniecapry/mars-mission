import { expect, test, type Page } from "@playwright/test";
import { crewEmail, mockApi, passengerEmail, password } from "./mockApi";

async function signIn( page: Page, email: string ): Promise<void>
{
    await page.getByLabel( "Email address" ).fill( email );
    await page.getByLabel( "Password" ).fill( password );
    await page.getByLabel( "Password" ).press( "Enter" );
}

test( "loading, invalid sign-in, and keyboard submission", async ({ page })=>
{
    let releaseSession = ()=>{};
    const sessionGate = new Promise<void>( resolve=>{ releaseSession = resolve; } );
    await mockApi( page, { role: "crew", sessionGate } );

    await page.goto( "/" );
    await expect( page.getByRole( "status" ) ).toContainText( "Connecting to mission control" );

    releaseSession();
    await expect( page.getByRole( "heading", { name: "Sign in" } ) ).toBeVisible();
    await signIn( page, "wrong@example.test" );
    await expect( page.getByRole( "alert" ) ).toHaveText( "Invalid email or password" );

    await signIn( page, crewEmail );
    await expect( page.getByRole( "heading", { name: "Access aboard X26" } ) ).toBeVisible();
} );

test( "crew can create a passenger, change membership, and see new activity", async ({ page })=>
{
    await page.clock.install();
    const api = await mockApi( page, { role: "crew" } );
    await page.goto( "/" );
    await signIn( page, crewEmail );
    await expect( page.getByRole( "heading", { name: "Access aboard X26" } ) ).toBeVisible();

    await page.getByRole( "navigation", { name: "Main navigation" } ).getByRole( "button", { name: "Passengers" } ).focus();
    await page.keyboard.press( "Enter" );
    await expect( page.getByRole( "heading", { name: "Passengers aboard" } ) ).toBeVisible();

    await page.getByRole( "button", { name: "Create passenger" } ).click();
    await expect( page.getByLabel( "Full name" ) ).toBeFocused();

    await page.getByLabel( "Full name" ).fill( "Noah Reed" );
    await page.getByLabel( "Email address" ).fill( "noah@example.test" );
    await page.getByLabel( "Temporary password" ).fill( "temporary-pass" );
    await page.getByRole( "button", { name: "Create passenger" } ).click();
    await expect( page.getByRole( "status" ) ).toContainText( "Passenger profile created." );
    await expect( page.getByText( "Noah Reed" ) ).toBeVisible();

    await page.getByLabel( "Membership level for Noah Reed" ).selectOption( "2" );
    await expect( page.getByRole( "status" ) ).toContainText( "Noah Reed is now Gold." );

    await page.getByRole( "navigation", { name: "Main navigation" } ).getByRole( "button", { name: "Activity" } ).click();
    await expect( page.getByText( "No resource interactions have been recorded yet." ) ).toBeVisible();
    api.recordActivity();
    await page.clock.fastForward( 5000 );
    await expect( page.getByRole( "row", { name: /Mira Chen Food Station Granted Silver/ } ) ).toBeVisible();
} );

test( "passenger use remains recorded when history refresh fails", async ({ page })=>
{
    const api = await mockApi( page, { role: "passenger" } );
    await page.goto( "/" );
    await signIn( page, passengerEmail );
    await expect( page.getByRole( "heading", { name: "Welcome aboard, Mira." } ) ).toBeVisible();

    await page.getByRole( "navigation", { name: "Main navigation" } ).getByRole( "button", { name: "My facilities" } ).click();
    await expect( page.getByRole( "heading", { name: "Food Station" } ) ).toBeVisible();
    await expect( page.getByRole( "heading", { name: "Private Cabin" } ) ).toHaveCount( 0 );

    api.failNextHistory();
    await page.getByRole( "button", { name: "Use facility" } ).click();
    await expect( page.getByRole( "status" ) ).toContainText( "Food Station use recorded. Some records could not be refreshed" );

    await page.getByRole( "button", { name: "Refresh data" } ).click();
    await page.getByRole( "navigation", { name: "Main navigation" } ).getByRole( "button", { name: "My history" } ).click();
    await expect( page.getByRole( "row", { name: /Food Station Granted Silver/ } ) ).toBeVisible();
} );

test( "workspace loading error can be retried", async ({ page })=>
{
    await mockApi( page, { role: "passenger", failFirstResourceLoad: true } );
    await page.goto( "/" );
    await signIn( page, passengerEmail );

    await expect( page.getByRole( "heading", { name: "Records are unavailable" } ) ).toBeVisible();
    await expect( page.getByRole( "alert" ) ).toContainText( "Mission records are unavailable" );
    await page.getByRole( "button", { name: "Retry" } ).click();
    await expect( page.getByRole( "heading", { name: "Welcome aboard, Mira." } ) ).toBeVisible();
} );

test.describe( "mobile", ()=>
{
    test.use( { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } );

    test( "passenger can navigate facilities and sign out without page overflow", async ({ page })=>
    {
        await mockApi( page, { role: "passenger" } );
        await page.goto( "/" );
        await signIn( page, passengerEmail );

        await page.getByRole( "navigation", { name: "Main navigation" } ).getByRole( "button", { name: "My facilities" } ).click();
        await expect( page.getByRole( "heading", { name: "Your facilities" } ) ).toBeVisible();
        await expect.poll( ()=>page.evaluate( ()=>document.documentElement.scrollWidth ) ).toBeLessThanOrEqual( 390 );

        await page.getByRole( "button", { name: "Sign out" } ).click();
        await expect( page.getByRole( "heading", { name: "Sign in" } ) ).toBeVisible();
    } );
} );