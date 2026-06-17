async function markComplete() {
  // ... existing mark complete logic ...
  
  // Add points for completing lesson
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    await addPoints(user.id, 20, 'Completed a lesson', 'lesson_complete', lessonId);
    
    // Check if all lessons in course are complete
    const { data: allLessons } = await supabase
      .from('lessons')
      .select('id')
      .eq('course_id', courseId);
    
    const { data: completedLessons } = await supabase
      .from('lesson_progress')
      .select('lesson_id')
      .eq('student_id', user.id)
      .eq('completed', true);
    
    const completedIds = completedLessons?.map(l => l.lesson_id) || [];
    if (allLessons?.length === completedIds.length) {
      // Course completed! Add bonus points and issue certificate
      await addPoints(user.id, 100, 'Completed full course', 'course_complete', courseId);
      
      // Check if certificate already exists
      const { data: existingCert } = await supabase
        .from('certificates')
        .select('id')
        .eq('student_id', user.id)
        .eq('course_id', courseId)
        .maybeSingle();
      
      if (!existingCert) {
        // Generate certificate
        const certNumber = await generateCertificateNumber();
        
        // Save certificate record
        await supabase
          .from('certificates')
          .insert({
            student_id: user.id,
            course_id: courseId,
            certificate_number: certNumber,
          });
        
        alert('🎉 Congratulations! You completed the course! You\'ve earned a certificate!');
      }
    }
  }
}