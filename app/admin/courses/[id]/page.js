{/* Lessons Manager */}
<section className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100">
  <div className="flex items-center justify-between mb-4">
    <h2 className="text-base font-extrabold text-brand-blue">Lessons</h2>
    <button
      onClick={addLesson}
      className="rounded-full bg-brand-yellow px-4 py-2 text-xs font-bold text-brand-dark"
    >
      + Add Lesson
    </button>
  </div>
  {lessons.length === 0 ? (
    <div className="text-center py-8 text-slate-400">No lessons yet. Click "Add Lesson" to start.</div>
  ) : (
    <div className="divide-y divide-slate-100">
      {lessons.map((lesson, idx) => (
        <div key={lesson.id} className="py-4">
          <div className="flex items-center gap-4">
            <div className="font-bold text-brand-blue w-8">{idx + 1}.</div>
            <div className="flex-1">
              <p className="font-semibold text-slate-800">{lesson.title}</p>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                <select
                  value={lesson.content_type || 'video'}
                  onChange={async (e) => {
                    const newType = e.target.value;
                    const supabase = createBrowserClient();
                    await supabase
                      .from('lessons')
                      .update({ content_type: newType })
                      .eq('id', lesson.id);
                    setLessons(lessons.map(l => 
                      l.id === lesson.id ? { ...l, content_type: newType } : l
                    ));
                  }}
                  className="text-xs border border-slate-200 rounded-lg px-2 py-1"
                >
                  <option value="video">🎬 Video</option>
                  <option value="text">📝 Text</option>
                  <option value="pdf">📄 PDF</option>
                </select>

                {lesson.content_type === 'video' && (
                  <>
                    {lesson.video_url ? (
                      <span className="text-xs text-green-600">✅ Video uploaded</span>
                    ) : (
                      <span className="text-xs text-yellow-600">⚠️ No video yet</span>
                    )}
                    <button
                      onClick={() => videoInputRefs.current[lesson.id]?.click()}
                      className="rounded-full bg-brand-blue px-3 py-1.5 text-xs font-bold text-white hover:opacity-90"
                    >
                      📹 Upload Video
                    </button>
                    <input
                      type="file"
                      ref={(el) => { if (el) videoInputRefs.current[lesson.id] = el; }}
                      accept="video/*"
                      onChange={(e) => {
                        if (e.target.files?.[0]) uploadVideo(lesson.id, e.target.files[0]);
                        e.target.value = '';
                      }}
                      className="hidden"
                    />
                  </>
                )}

                {lesson.content_type === 'text' && (
                  <div className="flex-1">
                    <textarea
                      placeholder="Enter lesson content (HTML allowed)"
                      rows="3"
                      value={lesson.text_content || ''}
                      onChange={async (e) => {
                        const newText = e.target.value;
                        const supabase = createBrowserClient();
                        await supabase
                          .from('lessons')
                          .update({ text_content: newText })
                          .eq('id', lesson.id);
                        setLessons(lessons.map(l => 
                          l.id === lesson.id ? { ...l, text_content: newText } : l
                        ));
                      }}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    />
                  </div>
                )}

                {lesson.content_type === 'pdf' && (
                  <div className="flex items-center gap-2">
                    {lesson.pdf_url ? (
                      <a href={lesson.pdf_url} target="_blank" className="text-xs text-blue-600 underline">📄 View PDF</a>
                    ) : (
                      <span className="text-xs text-yellow-600">⚠️ No PDF yet</span>
                    )}
                    <button
                      onClick={() => pdfInputRefs.current[lesson.id]?.click()}
                      className="rounded-full bg-brand-blue px-3 py-1.5 text-xs font-bold text-white hover:opacity-90"
                    >
                      📄 Upload PDF
                    </button>
                    <input
                      type="file"
                      ref={(el) => { if (el) pdfInputRefs.current[lesson.id] = el; }}
                      accept=".pdf"
                      onChange={(e) => {
                        if (e.target.files?.[0]) uploadPDF(lesson.id, e.target.files[0]);
                        e.target.value = '';
                      }}
                      className="hidden"
                    />
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={() => deleteLesson(lesson.id)}
              className="text-red-500 hover:text-red-700 text-sm"
            >
              Delete
            </button>
          </div>
          {lesson.video_url && lesson.content_type === 'video' && (
            <div className="mt-2 ml-12">
              <video src={lesson.video_url} controls className="h-24 rounded-lg" />
            </div>
          )}
          {lesson.content_type === 'text' && lesson.text_content && (
            <div className="mt-2 ml-12 text-sm text-slate-600 bg-slate-50 p-3 rounded-lg max-h-32 overflow-y-auto">
              {lesson.text_content}
            </div>
          )}
        </div>
      ))}
    </div>
  )}
  {uploading && (
    <div className="mt-4">
      <div className="w-full bg-gray-200 rounded-full h-2.5">
        <div className="bg-brand-yellow h-2.5 rounded-full transition-all" style={{ width: `${uploadProgress}%` }} />
      </div>
      <p className="text-xs text-gray-500 mt-1">Uploading... {uploadProgress}%</p>
    </div>
  )}
</section>