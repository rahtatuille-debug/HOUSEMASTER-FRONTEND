// The HouseMaster logo. The full logo (mark and name) sits on the light
// sign-in cards; the light version of
// the mark sits on navy backgrounds, such as the sign-up page.
export function LogoFull() {
  return (
    <h1 className="auth-logo">
      <img src="/housemaster-logo.png" alt="HouseMaster" />
    </h1>
  )
}

export function LogoMarkLight() {
  return <img className="logo-mark" src="/housemaster-mark-light.png" alt="" />
}
