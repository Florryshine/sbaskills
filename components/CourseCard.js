  
export default function CourseCard({ course }) {
  return (
    <div className="border rounded-lg p-4 shadow">
      <h3 className="font-bold">{course.title}</h3>
      <p className="text-gray-600">{course.description}</p>
    </div>
  );
}