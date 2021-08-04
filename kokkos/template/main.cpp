#include <iostream>
#include <Kokkos_Core.hpp>

class Particle {
  public:
    float pos, vel, acc;
};
class ParticleSoA {
  public:
    std::vector<float> pos, vel, acc;


  ParticleSoA() {};
  ParticleSoA(int n) {
    pos = std::vector<float>(n);
    vel = std::vector<float>(n);
    acc = std::vector<float>(n);
  };
};

bool check_res(std::vector<Particle> ref, std::vector<Particle> a);
bool check_res(std::vector<Particle> ref, Particle* a);
void dump(std::vector<Particle> a); 
void dump(ParticleSoA a); 
void vadd(std::vector<Particle> &a);


int main(int argc, char** argv) {
  int n = std::atoi(argv[1]);;
  Kokkos::initialize(argc, argv);
  {
  typedef Kokkos::Serial espace;
  typedef Kokkos::HostSpace mspace;
  typedef Kokkos::LayoutLeft layout;

  std::vector<Particle> x(n);
  ParticleSoA y(n);
  dump(x);
  dump(y);
  Kokkos::View<Particle*, layout, mspace> x_d("x", n);
  auto x_h = Kokkos::create_mirror_view(x_d);

  Kokkos::View<ParticleSoA, layout, mspace> y_d("y", n);
  auto y_h = Kokkos::create_mirror_view(y_d);

  Kokkos::parallel_for(n, KOKKOS_LAMBDA (int i) {
    x_d[i].pos = 1;
    x_d[i].vel = 1;
    x_d[i].acc = 1;
  });

  Kokkos::parallel_for(n, KOKKOS_LAMBDA (int i) {
    y_d.pos[i] = 1;
    y_d.vel[i] = 1;
    y_d.acc[i] = 1;
  });


  Kokkos::deep_copy(x_h, x_d);
  for (int i = 0; i < n; i++) {
    x[i] = x_h[i];
  }

  dump(x);
  dump(y);
  }
  Kokkos::finalize();
  return 0;
}

void dump(std::vector<Particle> a) {
  for (int i = 0; i < a.size(); i++)
    std::cout << "ptl[" << i << "]= <" \
      << a[i].pos << ","\
      << a[i].vel << ","\
      << a[i].acc << ">"\
      << std::endl;
  std::cout << std::endl;
}

void dump(ParticleSoA a) {
  for (int i = 0; i < a.pos.size(); i++)
    std::cout << "ptl[" << i << "]= <" \
      << a.pos[i] << ","\
      << a.vel[i] << ","\
      << a.acc[i] << ">"\
      << std::endl;
  std::cout << std::endl;
}

bool check_res(std::vector<Particle> ref, std::vector<Particle> a) {
  for (int i = 0; i < ref.size(); i++) {
    if (abs(ref[i].pos - a[i].pos) > 0.001 or \
        abs(ref[i].vel - a[i].vel) > 0.001 or \
        abs(ref[i].acc - a[i].acc) > 0.001) {
      std::cout << "Fail!\n";
      return false;
    }
  }
  return true;
}

/*
bool check_res(std::vector<float> ref, float* a) {
  for (int i = 0; i < ref.size(); i++) {
    if (abs(ref[i] - a[i]) > 0.001) {
      std::cout << "Fail!\n";
      return false;
    }
  }
  return true;
}
*/
