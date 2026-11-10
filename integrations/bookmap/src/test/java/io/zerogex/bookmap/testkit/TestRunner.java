package io.zerogex.bookmap.testkit;

import java.io.File;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.lang.reflect.Modifier;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/**
 * Finds every class named *Test under the test output directory and runs its
 * {@link Test} methods. Exits non-zero on any failure, printing each one.
 */
public final class TestRunner {

    public static void main(String[] args) throws Exception {
        File root = new File(TestRunner.class.getProtectionDomain().getCodeSource().getLocation().toURI());
        List<String> classes = new ArrayList<String>();
        collect(root, root, classes);
        java.util.Collections.sort(classes);
        int passed = 0;
        List<String> failures = new ArrayList<String>();
        for (String name : classes) {
            Class<?> c = Class.forName(name);
            Method[] methods = c.getMethods();
            Arrays.sort(methods, (a, b) -> a.getName().compareTo(b.getName()));
            int ran = 0;
            for (Method m : methods) {
                if (!m.isAnnotationPresent(Test.class) || Modifier.isStatic(m.getModifiers())) {
                    continue;
                }
                ran++;
                long started = System.nanoTime();
                try {
                    Object instance = c.getDeclaredConstructor().newInstance();
                    m.invoke(instance);
                    passed++;
                } catch (InvocationTargetException e) {
                    Throwable cause = e.getCause();
                    failures.add(c.getSimpleName() + "." + m.getName() + ": " + describe(cause));
                }
                long ms = (System.nanoTime() - started) / 1_000_000L;
                if (ms > 2000) {
                    System.out.println("  slow: " + c.getSimpleName() + "." + m.getName() + " " + ms + " ms");
                }
            }
            System.out.println(String.format("  %-34s %3d tests", c.getSimpleName(), ran));
        }
        System.out.println();
        if (!failures.isEmpty()) {
            for (String f : failures) {
                System.out.println("FAIL " + f);
                System.out.println();
            }
            System.out.println(passed + " passed, " + failures.size() + " failed");
            System.exit(1);
        }
        System.out.println(passed + " passed, 0 failed");
    }

    private static String describe(Throwable t) {
        StringBuilder sb = new StringBuilder(String.valueOf(t));
        for (StackTraceElement e : t.getStackTrace()) {
            if (e.getClassName().startsWith("io.zerogex")) {
                sb.append("\n    at ").append(e);
            }
        }
        return sb.toString();
    }

    private static void collect(File root, File dir, List<String> out) {
        File[] files = dir.listFiles();
        if (files == null) {
            return;
        }
        for (File f : files) {
            if (f.isDirectory()) {
                collect(root, f, out);
            } else if (f.getName().endsWith("Test.class") && !f.getName().contains("$")
                    && !f.getName().equals("Test.class")) {
                String rel = root.toURI().relativize(f.toURI()).getPath();
                out.add(rel.substring(0, rel.length() - ".class".length()).replace('/', '.'));
            }
        }
    }
}
