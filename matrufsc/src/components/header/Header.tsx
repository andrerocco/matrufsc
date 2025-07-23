export default function Header({
    campusOptions,
    campusValue,
    onCampusChange,
    semesterOptions,
    semesterValue,
    onSemesterChange,
}: {
    campusOptions: { title: string; value: string }[];
    campusValue: string;
    onCampusChange: (value: string) => void;
    semesterOptions: { title: string; value: string }[];
    semesterValue: string;
    onSemesterChange: (value: string) => void;
}) {
    return (
        <header className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-3">
                <h1 className="mr-3">MatrUFSC</h1>
                <select
                    name="campus"
                    id="campus"
                    className="bg-transparent focus:border-transparent focus:outline-hidden"
                    value={campusValue}
                    onChange={(e) => onCampusChange(e.target.value)}
                >
                    {campusOptions.map((campus) => (
                        <option key={campus.value} value={campus.value}>
                            {campus.title}
                        </option>
                    ))}
                </select>
                <select
                    name="semester"
                    id="semester"
                    className="bg-transparent focus:border-transparent focus:outline-hidden"
                    value={semesterValue}
                    onChange={(e) => onSemesterChange(e.target.value)}
                >
                    {semesterOptions.map((semester) => (
                        <option key={semester.value} value={semester.value}>
                            {semester.title}
                        </option>
                    ))}
                </select>
            </div>
        </header>
    );
}
