export default function Footer() {
  return (
    <footer className="bg-brand-blue text-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-3 lg:px-8">
        <div>
          <h3 className="text-2xl font-bold">Shiney Brain Academy</h3>
          <p className="mt-3 max-w-md text-sm leading-6 text-blue-100">
            Premium JAMB preparation for focused Nigerian students who want structure, confidence, and winning results.
          </p>
        </div>
        <div>
          <h4 className="text-lg font-semibold text-brand-yellow">Contact</h4>
          <p className="mt-3 text-sm text-blue-100">08138082009</p>
          <p className="text-sm text-blue-100">09053626207</p>
        </div>
        <div>
          <h4 className="text-lg font-semibold text-brand-yellow">Promise</h4>
          <p className="mt-3 text-sm leading-6 text-blue-100">
            We help students master key subjects, stay consistent, and prepare like future champions.
          </p>
        </div>
      </div>
    </footer>
  );
}
